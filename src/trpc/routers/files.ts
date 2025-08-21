import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'
import { TRPCError } from '@trpc/server'
import { createDocument } from '@/db/queries/knowledge'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_GIF_BYTES = 15 * 1024 * 1024 // 15MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB (MVP-safe)
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10MB for documents

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

const FILE_TYPE_MAP = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'txt',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
} as const

function inferExtension(mime: string) {
  if (mime === 'image/gif') return 'gif'
  if (mime.startsWith('image/')) return mime.split('/')[1] || 'png'
  if (mime === 'video/mp4') return 'mp4'
  if (mime === 'video/quicktime') return 'mov'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mime === 'text/plain' || mime === 'text/markdown') return 'txt'
  return 'bin'
}

export const filesRouter = createTRPCRouter({
  createPresignedPost: protectedProcedure
    .input(z.object({ 
      fileName: z.string().min(1), 
      fileType: z.string().min(1),
      source: z.enum(['knowledge', 'chat']).optional().default('chat')
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('🚀 [FILES] Starting createPresignedPost mutation')
      console.log('🔧 [FILES] R2 Config:', {
        bucketName: R2_BUCKET_NAME,
        hasR2Client: !!r2Client,
        userId: ctx.user.id,
      })

      if (!R2_BUCKET_NAME) {
        console.error('❌ [FILES] R2 bucket not configured')
        throw new Error('R2 bucket not configured')
      }

      const { fileName, fileType, source } = input
      console.log('📄 [FILES] Input:', { fileName, fileType, source })

      const isImage = fileType.startsWith('image/') && fileType !== 'image/gif'
      const isGif = fileType === 'image/gif'
      const isVideo = fileType.startsWith('video/')
      const isDocument = ALLOWED_DOCUMENT_TYPES.includes(fileType)

      const isValidFileType = [...ALLOWED_DOCUMENT_TYPES, ...ALLOWED_IMAGE_TYPES, 'video/mp4', 'video/quicktime'].includes(fileType)
      
      if (!isValidFileType) {
        console.error('❌ [FILES] Unsupported file type:', fileType)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid file type. Please upload a document (pdf, docx, txt) or image'
        })
      }

      const maxSize = isImage ? MAX_IMAGE_BYTES : 
                     isGif ? MAX_GIF_BYTES : 
                     isVideo ? MAX_VIDEO_BYTES : 
                     isDocument ? MAX_DOCUMENT_BYTES : 0

      console.log('📏 [FILES] File validation:', { isImage, isGif, isVideo, isDocument, maxSize })

      const ext = inferExtension(fileType)
      const key = `${source}/${ctx.user.id}/${nanoid()}.${ext}`
      console.log('🔑 [FILES] Generated key:', key)

      try {
        console.log('🔄 [FILES] Creating presigned POST...')
        const presignedPostConfig = {
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Conditions: [
            ['content-length-range', 1, maxSize],
            { 'Content-Type': fileType },
          ],
          Fields: {
            'Content-Type': fileType,
            'Cache-Control': 'max-age=31536000,public',
          },
          Expires: 300, // 5 minutes
        }
        console.log('⚙️  [FILES] Presigned POST config:', presignedPostConfig)

        const { url, fields } = await createPresignedPost(r2Client, presignedPostConfig)
        
        console.log('✅ [FILES] Presigned POST created successfully')
        console.log('🌐 [FILES] URL:', url)
        console.log('🏷️  [FILES] Fields:', fields)
        
        const type = FILE_TYPE_MAP[fileType as keyof typeof FILE_TYPE_MAP]
        
        return { url, fields, key, type }
      } catch (error) {
        console.error('❌ [FILES] Failed to create presigned POST:', error)
        throw error
      }
    }),

  // Promote a uploaded file to a knowledge document with content extraction
  promoteToKnowledgeDocument: protectedProcedure
    .input(z.object({
      fileKey: z.string(),
      fileName: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { fileKey, fileName, title, description } = input
      
      try {
        // Extract file type from the key or determine it
        const ext = fileKey.split('.').pop()
        let type: 'pdf' | 'docx' | 'txt' | 'image' | 'url' | 'manual' = 'manual'
        
        if (ext === 'pdf') type = 'pdf'
        else if (ext === 'docx') type = 'docx'
        else if (ext === 'txt') type = 'txt'
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) type = 'image'

        let extractedDescription = description || ''
        let metadata: Record<string, any> = {}

        // Extract content from document files
        if (type === 'pdf' || type === 'docx' || type === 'txt') {
          try {
            const getObjectCommand = new GetObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: fileKey,
            })
            
            const response = await r2Client.send(getObjectCommand)
            const bodyBytes = await response.Body?.transformToByteArray()
            
            if (bodyBytes) {
              const buffer = Buffer.from(bodyBytes)
              
              if (type === 'pdf') {
                const { info, text } = await pdfParse(buffer)
                
                let metadataDescription = ''
                if (info?.Title) {
                  metadataDescription += info.Title
                }
                if (info?.Subject && info.Subject !== info?.Title) {
                  metadataDescription += metadataDescription ? ` - ${info.Subject}` : info.Subject
                }
                if (info?.Author) {
                  metadataDescription += metadataDescription
                    ? ` by ${info.Author}`
                    : `by ${info.Author}`
                }
                
                extractedDescription = (metadataDescription.trim() + ' ' + text.slice(0, 200)).slice(0, 300)
                metadata = {
                  content: text,
                  pdfInfo: info,
                  wordCount: text.split(/\s+/).length,
                  pageCount: info?.numpages || 0,
                }
              } else if (type === 'docx') {
                const { value } = await mammoth.extractRawText({ buffer })
                extractedDescription = value.slice(0, 300)
                metadata = {
                  content: value,
                  wordCount: value.split(/\s+/).length,
                }
              } else if (type === 'txt') {
                const text = buffer.toString('utf-8')
                extractedDescription = text.slice(0, 300)
                metadata = {
                  content: text,
                  wordCount: text.split(/\s+/).length,
                }
              }
            }
          } catch (extractionError) {
            console.warn('Failed to extract content from document:', extractionError)
            extractedDescription = description || 'Content extraction failed'
          }
        }

        const document = await createDocument({
          title: title || fileName,
          fileName,
          type,
          s3Key: fileKey,
          description: extractedDescription,
          metadata,
          userId: ctx.user.id,
        })

        return {
          success: true,
          document
        }
      } catch (error) {
        console.error('Error promoting file to knowledge document:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create knowledge document'
        })
      }
    }),
}) 