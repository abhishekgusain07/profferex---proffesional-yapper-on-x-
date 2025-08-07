import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { nanoid } from 'nanoid'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_GIF_BYTES = 15 * 1024 * 1024 // 15MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB (MVP-safe)

function inferExtension(mime: string) {
  if (mime === 'image/gif') return 'gif'
  if (mime.startsWith('image/')) return mime.split('/')[1] || 'png'
  if (mime === 'video/mp4') return 'mp4'
  if (mime === 'video/quicktime') return 'mov'
  return 'bin'
}

export const filesRouter = createTRPCRouter({
  createPresignedPost: protectedProcedure
    .input(z.object({ fileName: z.string().min(1), fileType: z.string().min(1) }))
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

      const { fileName, fileType } = input
      console.log('📄 [FILES] Input:', { fileName, fileType })

      const isImage = fileType.startsWith('image/') && fileType !== 'image/gif'
      const isGif = fileType === 'image/gif'
      const isVideo = fileType.startsWith('video/')

      const maxSize = isImage ? MAX_IMAGE_BYTES : isGif ? MAX_GIF_BYTES : isVideo ? MAX_VIDEO_BYTES : 0
      console.log('📏 [FILES] File validation:', { isImage, isGif, isVideo, maxSize })

      if (!maxSize) {
        console.error('❌ [FILES] Unsupported file type:', fileType)
        throw new Error('Unsupported file type')
      }

      const ext = inferExtension(fileType)
      const key = `${ctx.user.id}/${nanoid()}.${ext}`
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
        
        return { url, fields, key }
      } catch (error) {
        console.error('❌ [FILES] Failed to create presigned POST:', error)
        throw error
      }
    }),
}) 