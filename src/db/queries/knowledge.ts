import { db } from '../index'
import { eq, desc, and, or, like, inArray, sql } from 'drizzle-orm'
import { KnowledgeDocument, knowledgeDocument, knowledgeTags } from '../schema'

export interface CreateDocumentInput {
  title: string
  fileName: string
  type: 'url' | 'txt' | 'docx' | 'pdf' | 'image' | 'manual'
  s3Key: string
  description?: string
  sourceUrl?: string
  metadata?: Record<string, any>
  userId: string
  sizeBytes?: number
}

export interface UpdateDocumentInput {
  title?: string
  description?: string
  isStarred?: boolean
  metadata?: Record<string, any>
}

export const createDocument = async (input: CreateDocumentInput) => {
  const [created] = await db
    .insert(knowledgeDocument)
    .values(input)
    .returning()

  return created
}

export const updateDocument = async (
  documentId: string,
  userId: string,
  input: UpdateDocumentInput,
) => {
  const updateData = { ...input, updatedAt: new Date() }

  const [updated] = await db
    .update(knowledgeDocument)
    .set(updateData)
    .where(
      and(eq(knowledgeDocument.id, documentId), eq(knowledgeDocument.userId, userId)),
    )
    .returning()

  return updated || null
}

export const getDocument = async (documentId: string, userId: string) => {
  const [document] = await db
    .select()
    .from(knowledgeDocument)
    .where(
      and(eq(knowledgeDocument.id, documentId), eq(knowledgeDocument.userId, userId)),
    )
    .limit(1)

  return document || null
}

export const listKnowledgeDocuments = async (
  userId: string,
  options?: {
    isStarred?: boolean
    search?: string
    limit?: number
    offset?: number
  },
) => {
  const conditions = [
    eq(knowledgeDocument.userId, userId),
    or(eq(knowledgeDocument.isDeleted, false), eq(knowledgeDocument.isExample, true)),
  ]

  if (options?.isStarred !== undefined) {
    conditions.push(eq(knowledgeDocument.isStarred, options.isStarred))
  }

  if (options?.search) {
    conditions.push(
      or(
        like(knowledgeDocument.title, `%${options.search}%`),
        like(knowledgeDocument.description, `%${options.search}%`)
      )
    )
  }

  const query = db
    .select({
      id: knowledgeDocument.id,
      title: knowledgeDocument.title,
      type: knowledgeDocument.type,
      isStarred: knowledgeDocument.isStarred,
      sourceUrl: knowledgeDocument.sourceUrl,
      createdAt: knowledgeDocument.createdAt,
      updatedAt: knowledgeDocument.updatedAt,
      metadata: knowledgeDocument.metadata,
      s3Key: knowledgeDocument.s3Key,
      isExample: knowledgeDocument.isExample,
      isDeleted: knowledgeDocument.isDeleted,
      description: knowledgeDocument.description,
      sizeBytes: knowledgeDocument.sizeBytes,
      fileName: knowledgeDocument.fileName,
    })
    .from(knowledgeDocument)
    .where(and(...conditions))
    .orderBy(desc(knowledgeDocument.updatedAt))
    .$dynamic()

  if (options?.limit) {
    query.limit(options.limit)
  }

  if (options?.offset) {
    query.offset(options.offset)
  }

  return await query
}

export const deleteKnowledgeDocument = async (
  documentId: string,
  userId: string,
): Promise<boolean> => {
  const [result] = await db
    .update(knowledgeDocument)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(eq(knowledgeDocument.id, documentId), eq(knowledgeDocument.userId, userId)),
    )
    .returning()

  return !!result
}