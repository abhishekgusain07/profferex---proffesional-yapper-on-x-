import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { db } from '@/db'
import { chatConversations, chatMessages } from '@/db/schema'
import { redis } from '@/lib/redis'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { Ratelimit } from '@upstash/ratelimit'
import { eq, desc, and } from 'drizzle-orm'

// Types for the API (matching the open source pattern)
export interface MyUIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: Array<{
    type: string
    text?: string
    data?: {
      text: string
      status: string
    }
  }>
  metadata?: {
    userMessage?: string
    editorContent?: string
    attachments?: Array<{
      id: string
      title?: string
      type: string
      variant: string
      fileKey?: string
      content?: string
    }>
  }
}

export interface ChatHistoryItem {
  id: string
  title: string
  lastUpdated: string
}

// Rate limiting setup
const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1h'),
})

// Helper functions
async function saveMessagesToRedis(chatId: string, messages: MyUIMessage[]): Promise<void> {
  await redis.set(`chat:history:${chatId}`, messages, { ex: 60 * 60 * 24 * 30 }) // 30 days
}

async function getMessagesFromRedis(chatId: string): Promise<MyUIMessage[]> {
  const messages = await redis.get<MyUIMessage[]>(`chat:history:${chatId}`)
  return messages || []
}

async function saveChatHistoryList(userEmail: string, chatHistory: ChatHistoryItem[]): Promise<void> {
  const historyKey = `chat:history-list:${userEmail}`
  await redis.set(historyKey, chatHistory, { ex: 60 * 60 * 24 * 30 })
}

async function getChatHistoryList(userEmail: string): Promise<ChatHistoryItem[]> {
  const historyKey = `chat:history-list:${userEmail}`
  const chatHistory = await redis.get<ChatHistoryItem[]>(historyKey)
  return chatHistory || []
}

async function updateChatHistoryList(userEmail: string, chatId: string, title: string): Promise<void> {
  const existingHistory = await getChatHistoryList(userEmail)
  
  const chatHistoryItem: ChatHistoryItem = {
    id: chatId,
    title: title.slice(0, 50) + (title.length > 50 ? '...' : ''),
    lastUpdated: new Date().toISOString(),
  }
  
  // Remove existing entry and add new one at the beginning
  const updatedHistory = [
    chatHistoryItem,
    ...existingHistory.filter((item) => item.id !== chatId),
  ]
  
  await saveChatHistoryList(userEmail, updatedHistory.slice(0, 20)) // Keep only last 20 chats
}

export const chatRouter = createTRPCRouter({
  // Get message history for a specific chat
  get_message_history: protectedProcedure
    .input(z.object({ chatId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const { chatId } = input
      const { user } = ctx

      if (!chatId) {
        return { messages: [] }
      }

      const messages = await getMessagesFromRedis(chatId)
      return { messages }
    }),

  // Get chat history list (recent conversations)
  history: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx
      
      const chatHistory = await getChatHistoryList(user.email)
      
      return {
        chatHistory: chatHistory.slice(0, 20), // Return last 20 chats
      }
    }),

  // Get conversations (comprehensive list)
  getConversations: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx
      const { limit, offset } = input
      
      try {
        const conversations = await db
          .select({
            id: chatConversations.id,
            title: chatConversations.title,
            lastUpdated: chatConversations.lastMessageAt,
            messageCount: chatConversations.messageCount,
          })
          .from(chatConversations)
          .where(eq(chatConversations.userId, user.id))
          .orderBy(desc(chatConversations.lastMessageAt))
          .limit(limit)
          .offset(offset)
        
        const total = await db
          .select({ count: chatConversations.id })
          .from(chatConversations)
          .where(eq(chatConversations.userId, user.id))
        
        return {
          conversations: conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            lastUpdated: conv.lastUpdated.toISOString(),
            messageCount: conv.messageCount,
          })),
          total: total.length,
          hasMore: offset + limit < total.length,
        }
      } catch (error) {
        console.error('Failed to get conversations:', error)
        return {
          conversations: [],
          total: 0,
          hasMore: false,
        }
      }
    }),

  // Create new conversation
  createConversation: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { user } = ctx
      
      try {
        const [conversation] = await db
          .insert(chatConversations)
          .values({
            userId: user.id,
            title: 'New Conversation',
          })
          .returning()
        
        return { conversationId: conversation.id }
      } catch (error) {
        console.error('Failed to create conversation:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create conversation',
        })
      }
    }),

  // Delete conversation
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { conversationId } = input
      
      try {
        // Check if user owns this conversation
        const conversation = await db
          .select()
          .from(chatConversations)
          .where(and(
            eq(chatConversations.id, conversationId),
            eq(chatConversations.userId, user.id)
          ))
          .limit(1)
        
        if (!conversation.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Conversation not found',
          })
        }
        
        // Delete conversation and its messages (cascade delete)
        await db
          .delete(chatConversations)
          .where(eq(chatConversations.id, conversationId))
        
        // Clean up Redis cache
        await redis.del(`chat:history:${conversationId}`)
        
        // Update history list
        const chatHistory = await getChatHistoryList(user.email)
        const updatedHistory = chatHistory.filter(item => item.id !== conversationId)
        await saveChatHistoryList(user.email, updatedHistory)
        
        return { success: true }
      } catch (error) {
        console.error('Failed to delete conversation:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete conversation',
        })
      }
    }),

  // Get rate limit info
  getRateLimit: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx
      
      const result = await chatRateLimit.limit(user.id)
      
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    }),
})