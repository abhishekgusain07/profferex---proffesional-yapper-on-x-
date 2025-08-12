import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { 
  listKnowledgeDocuments, 
  createDocument, 
  updateDocument, 
  deleteKnowledgeDocument,
  getDocument 
} from '@/db/queries/knowledge'
import { TRPCError } from '@trpc/server'

export const knowledgeRouter = createTRPCRouter({
  // List all knowledge documents for the user
  list: protectedProcedure
    .input(
      z.object({
        isStarred: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(100).optional(),
        offset: z.number().min(0).default(0).optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      try {
        const documents = await listKnowledgeDocuments(ctx.user.id, {
          isStarred: input.isStarred,
          search: input.search,
          limit: input.limit ?? 100,
          offset: input.offset ?? 0,
        })

        return {
          documents,
          total: documents.length,
        }
      } catch (error) {
        console.error('Error listing knowledge documents:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list documents',
        })
      }
    }),

  // Get a specific document by ID
  getDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const document = await getDocument(input.id, ctx.user.id)

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          })
        }

        return { document }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        console.error('Error getting document:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get document',
        })
      }
    }),

  // Create a new knowledge document
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      fileName: z.string(),
      type: z.enum(['url', 'txt', 'docx', 'pdf', 'image', 'manual']),
      s3Key: z.string(),
      description: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      metadata: z.record(z.any()).optional(),
      sizeBytes: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const document = await createDocument({
          ...input,
          userId: ctx.user.id,
        })

        return {
          success: true,
          document,
        }
      } catch (error) {
        console.error('Error creating document:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create document',
        })
      }
    }),

  // Update a knowledge document
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      isStarred: z.boolean().optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input

      try {
        const document = await updateDocument(id, ctx.user.id, updateData)

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          })
        }

        return {
          success: true,
          document,
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        console.error('Error updating document:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update document',
        })
      }
    }),

  // Delete (soft delete) a knowledge document
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const success = await deleteKnowledgeDocument(input.id, ctx.user.id)

        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          })
        }

        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        console.error('Error deleting document:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete document',
        })
      }
    }),

  // Import URL as knowledge document
  importUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // For now, create a simple URL document
        // TODO: Add web scraping functionality
        const document = await createDocument({
          title: `Website: ${new URL(input.url).hostname}`,
          fileName: '',
          type: 'url',
          s3Key: '',
          description: 'Imported website content',
          sourceUrl: input.url,
          userId: ctx.user.id,
        })

        return {
          success: true,
          documentId: document.id,
          title: document.title,
          url: input.url,
        }
      } catch (error) {
        console.error('Error importing URL:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to import URL',
        })
      }
    }),
})