import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { redis } from '@/lib/redis'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { Ratelimit } from '@upstash/ratelimit'
import { 
  streamText, 
  convertToCoreMessages, 
  type CoreMessage,
} from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOpenAI } from '@ai-sdk/openai'
import type {
  ChatMessage,
  ChatConversation,
  ChatHistoryItem,
  MessageMetadata,
  Attachment,
  RateLimitInfo,
} from '@/types/chat'

// AI Provider setup
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Rate limiting setup
const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1h'), // 10 messages per hour for free users
})

const chatRateLimitPro = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1h'), // 100 messages per hour for pro users
})

// Validation schemas
const messageMetadataSchema = z.object({
  attachments: z.array(z.object({
    id: z.string(),
    title: z.string().optional(),
    type: z.enum(['url', 'txt', 'docx', 'pdf', 'image', 'manual', 'video']),
    variant: z.enum(['knowledge', 'chat']),
    fileKey: z.string().optional(),
    content: z.string().optional(),
  })).optional(),
  userMessage: z.string().optional(),
  editorContent: z.string().optional(),
  timestamp: z.number().optional(),
})

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  metadata: messageMetadataSchema.optional(),
})

const getHistorySchema = z.object({
  conversationId: z.string(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

const getConversationsSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
})

// Helper functions
async function checkRateLimit(userId: string, isPro: boolean = false): Promise<RateLimitInfo> {
  const limiter = isPro ? chatRateLimitPro : chatRateLimit
  const result = await limiter.limit(userId)
  
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

async function saveMessage(message: Omit<ChatMessage, 'createdAt'> & { createdAt?: Date }, userId: string): Promise<ChatMessage> {
  const fullMessage: ChatMessage = {
    ...message,
    createdAt: message.createdAt || new Date(),
  }
  
  // Save individual message
  await redis.set(`chat:message:${message.id}`, JSON.stringify(fullMessage), { ex: 60 * 60 * 24 * 30 }) // 30 days
  
  // Add to conversation message list
  await redis.lpush(`chat:conversation:${message.chatId}:messages`, message.id)
  
  // Update conversation metadata
  await updateConversationMetadata(message.chatId, message.content, message.role === 'user', userId)
  
  return fullMessage
}

async function getMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
  const messageIds = await redis.lrange(`chat:conversation:${conversationId}:messages`, offset, offset + limit - 1)
  
  if (!messageIds.length) {
    return []
  }
  
  const messages = await Promise.all(
    messageIds.map(async (id) => {
      const messageData = await redis.get(`chat:message:${id}`)
      return messageData ? JSON.parse(messageData as string) : null
    })
  )
  
  return messages.filter(Boolean).reverse() // Reverse to get chronological order
}

async function updateConversationMetadata(
  conversationId: string, 
  lastMessageContent: string, 
  isUserMessage: boolean,
  userId: string
): Promise<void> {
  const now = new Date().toISOString()
  const conversationData = await redis.get(`chat:conversation:${conversationId}`)
  const conversation = conversationData ? JSON.parse(conversationData as string) : null
  
  let title = conversation?.title || 'New Conversation'
  
  // Auto-generate title from first user message
  if (isUserMessage && (!conversation || conversation.title === 'New Conversation')) {
    title = lastMessageContent.slice(0, 50) + (lastMessageContent.length > 50 ? '...' : '')
  }
  
  const updatedConversation = {
    id: conversationId,
    title,
    userId: conversation?.userId || userId,
    createdAt: conversation?.createdAt || now,
    updatedAt: now,
    lastMessageAt: now,
    messageCount: (conversation?.messageCount || 0) + 1,
  }
  
  await redis.set(`chat:conversation:${conversationId}`, JSON.stringify(updatedConversation), { ex: 60 * 60 * 24 * 30 })
}

async function getUserConversations(userId: string, limit: number, offset: number): Promise<ChatHistoryItem[]> {
  // Get conversation IDs for user
  const conversationIds = await redis.lrange(`user:${userId}:conversations`, offset, offset + limit - 1)
  
  if (!conversationIds.length) {
    return []
  }
  
  const conversations = await Promise.all(
    conversationIds.map(async (id) => {
      const conversationData = await redis.get(`chat:conversation:${id}`)
      return conversationData ? JSON.parse(conversationData as string) : null
    })
  )
  
  return conversations
    .filter(Boolean)
    .map((conv) => ({
      id: conv.id,
      title: conv.title,
      lastUpdated: conv.lastMessageAt,
      messageCount: conv.messageCount,
    }))
}

async function createConversation(userId: string): Promise<string> {
  const conversationId = nanoid()
  const now = new Date().toISOString()
  
  const conversation = {
    id: conversationId,
    title: 'New Conversation',
    userId,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    messageCount: 0,
  }
  
  await Promise.all([
    redis.set(`chat:conversation:${conversationId}`, JSON.stringify(conversation), { ex: 60 * 60 * 24 * 30 }),
    redis.lpush(`user:${userId}:conversations`, conversationId),
  ])
  
  return conversationId
}

function buildSystemPrompt(): string {
  return `You are an AI assistant specialized in helping users create engaging Twitter/X posts. Your primary goals are:

1. Help generate creative, engaging, and authentic Twitter content
2. Provide suggestions for improving existing tweets
3. Help brainstorm ideas based on user interests, industry, or topics
4. Ensure content follows Twitter best practices (character limits, engagement tactics)
5. Adapt to the user's writing style and voice

Guidelines:
- Keep tweets under 280 characters when generating them
- Be conversational and helpful
- Ask clarifying questions when needed
- Provide multiple options when appropriate
- Consider current trends and best practices for social media engagement
- Be concise but informative in your responses

When generating tweets, format them clearly and indicate they are tweet suggestions.`
}

export const chatRouter = createTRPCRouter({
  // Send a message and get AI response
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { content, conversationId, metadata } = input
      
      // Check rate limits
      const rateLimit = await checkRateLimit(user.id, false) // TODO: Add pro plan check
      if (!rateLimit.success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Rate limit exceeded. Please try again in ${Math.ceil((rateLimit.reset - Date.now()) / 1000)} seconds.`,
        })
      }
      
      // Get or create conversation
      let activeConversationId = conversationId
      if (!activeConversationId) {
        activeConversationId = await createConversation(user.id)
      }
      
      // Create user message
      const userMessageId = nanoid()
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content,
        chatId: activeConversationId,
        createdAt: new Date(),
        metadata,
      }
      
      // Save user message
      await saveMessage(userMessage, user.id)
      
      // Get conversation history for context
      const previousMessages = await getMessages(activeConversationId, 10)
      
      // Build messages for AI
      const coreMessages: CoreMessage[] = [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        ...convertToCoreMessages(
          previousMessages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          }))
        ),
      ]
      
      try {
        // Use OpenRouter or OpenAI based on availability
        const aiProvider = process.env.OPENROUTER_API_KEY ? openrouter : openai
        const model = process.env.OPENROUTER_API_KEY 
          ? 'anthropic/claude-3.5-sonnet' 
          : 'gpt-4o-mini'
        
        const result = await streamText({
          model: aiProvider(model),
          messages: coreMessages,
          temperature: 0.7,
          maxTokens: 1000,
        })
        
        // Get the response text
        const responseText = await result.text
        
        // Create assistant message
        const assistantMessageId = nanoid()
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: responseText,
          chatId: activeConversationId,
          createdAt: new Date(),
        }
        
        // Save assistant message
        await saveMessage(assistantMessage, user.id)
        
        return {
          conversationId: activeConversationId,
          userMessage,
          assistantMessage,
          rateLimit,
        }
      } catch (error) {
        console.error('Chat AI Error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate AI response. Please try again.',
        })
      }
    }),

  // Get conversation history
  getHistory: protectedProcedure
    .input(getHistorySchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx
      const { conversationId, limit, offset } = input
      
      // Check if user owns this conversation
      const conversationData = await redis.get(`chat:conversation:${conversationId}`)
      if (!conversationData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }
      const conversation = JSON.parse(conversationData as string)
      if (conversation.userId !== user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }
      
      const messages = await getMessages(conversationId, limit, offset)
      
      return {
        messages,
        total: conversation.messageCount,
        hasMore: offset + limit < conversation.messageCount,
      }
    }),

  // Get user's conversations
  getConversations: protectedProcedure
    .input(getConversationsSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx
      const { limit, offset } = input
      
      const conversations = await getUserConversations(user.id, limit, offset)
      const totalKey = `user:${user.id}:conversations`
      const total = await redis.llen(totalKey)
      
      return {
        conversations,
        total,
        hasMore: offset + limit < total,
      }
    }),

  // Delete a conversation
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { conversationId } = input
      
      // Check if user owns this conversation
      const conversationData = await redis.get(`chat:conversation:${conversationId}`)
      if (!conversationData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }
      const conversation = JSON.parse(conversationData as string)
      if (conversation.userId !== user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        })
      }
      
      // Get all message IDs
      const messageIds = await redis.lrange(`chat:conversation:${conversationId}:messages`, 0, -1)
      
      // Delete all messages
      const deletePromises = messageIds.map(id => redis.del(`chat:message:${id}`))
      
      // Delete conversation data
      deletePromises.push(
        redis.del(`chat:conversation:${conversationId}`),
        redis.del(`chat:conversation:${conversationId}:messages`),
        redis.lrem(`user:${user.id}:conversations`, 1, conversationId)
      )
      
      await Promise.all(deletePromises)
      
      return { success: true }
    }),

  // Create new conversation
  createConversation: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { user } = ctx
      
      const conversationId = await createConversation(user.id)
      
      return { conversationId }
    }),

  // Get rate limit info
  getRateLimit: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx
      
      const rateLimit = await checkRateLimit(user.id, false) // TODO: Add pro plan check
      
      return rateLimit
    }),
})