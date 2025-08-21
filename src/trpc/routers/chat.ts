import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { db } from '@/db'
import { chatConversations, chatMessages } from '@/db/schema'
import { redis } from '@/lib/redis'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { Ratelimit } from '@upstash/ratelimit'
import { eq, desc, and } from 'drizzle-orm'
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
  UIMessage,
  generateId,
} from 'ai'
import { format } from 'date-fns'
import { HTTPException } from 'hono/http-exception'
import { createTweetTool } from './chat/tools/create-tweet-tool'
import { createReadWebsiteContentTool } from '@/lib/read-website-content'
import { getDocument } from '@/db/queries/knowledge'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { assistantPrompt } from '@/lib/prompt-utils'
import { XmlPrompt } from '@/lib/xml-prompt'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

// Proper MyUIMessage type matching @contentport/ pattern with tRPC adaptations
export type MyUIMessage = UIMessage<
  Metadata,
  {
    'main-response': {
      text: string
      status: 'streaming' | 'complete'
    }
    'tool-output': {
      text: string
      index: number
      status: 'processing' | 'streaming' | 'complete'
    }
    writeTweet: {
      status: 'processing'
    }
  },
  {
    readWebsiteContent: {
      input: { website_url: string }
      output: {
        url: string
        title: string
        content: string
      }
    }
  }
>

export type Metadata = {
  userMessage: string
  attachments: Array<TAttachment>
  tweets: Array<{
    id: string
    content: string
    index: number
  }>
}

export type TAttachment = {
  id: string
  title?: string
  fileKey?: string
  type: 'url' | 'txt' | 'docx' | 'pdf' | 'image' | 'manual' | 'video'
  variant: 'knowledge' | 'chat'
}

export type MessageMetadata = {
  attachments?: Array<TAttachment>
}

export type ChatMessage = {
  id: string
  chatId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: MessageMetadata
}

export interface WebScrapingResult {
  url: string
  content?: string
  screenshot?: string
  error?: string
}

export interface ChatHistoryItem {
  id: string
  title: string
  lastUpdated: string
  messageCount: number
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
  const messages = await redis.get(`chat:history:${chatId}`) as MyUIMessage[] | null
  return messages || []
}

async function saveChatHistoryList(userEmail: string, chatHistory: ChatHistoryItem[]): Promise<void> {
  const historyKey = `chat:history-list:${userEmail}`
  await redis.set(historyKey, chatHistory, { ex: 60 * 60 * 24 * 30 })
}

async function getChatHistoryList(userEmail: string): Promise<ChatHistoryItem[]> {
  const historyKey = `chat:history-list:${userEmail}`
  const chatHistory = await redis.get(historyKey) as ChatHistoryItem[] | null
  return chatHistory || []
}

async function updateChatHistoryList(userEmail: string, chatId: string, title: string): Promise<void> {
  const existingHistory = await getChatHistoryList(userEmail)
  
  const chatHistoryItem: ChatHistoryItem = {
    id: chatId,
    title: title.slice(0, 50) + (title.length > 50 ? '...' : ''),
    lastUpdated: new Date().toISOString(),
    messageCount: 0  // Add missing required property
  }
  
  // Remove existing entry and add new one at the beginning
  const updatedHistory = [
    chatHistoryItem,
    ...existingHistory.filter((item) => item.id !== chatId),
  ]
  
  await saveChatHistoryList(userEmail, updatedHistory.slice(0, 20)) // Keep only last 20 chats
}

// Parse attachments helper - Enhanced to handle knowledge documents
async function parseAttachments({
  attachments,
  userId,
}: {
  attachments?: Array<TAttachment>
  userId: string
}) {
  const links: Array<{ link: string; content?: string }> = []
  const parsedAttachments: Array<{ type: string; text?: string; title?: string }> = []

  if (!attachments) {
    return { links, attachments: parsedAttachments }
  }

  console.log('🔍 Processing attachments:', attachments.length, 'items')

  for (const attachment of attachments) {
    console.log('📎 Processing attachment:', attachment.id, attachment.variant, attachment.type)

    if (attachment.variant === 'knowledge') {
      // Handle knowledge documents
      try {
        const document = await getDocument(attachment.id, userId)
        
        if (document) {
          console.log('📄 Knowledge document found:', document.title, 'type:', document.type)
          
          if (document.type === 'url' && document.sourceUrl) {
            // For URL knowledge documents, add as link with content
            const content = document.metadata?.content || document.description || ''
            links.push({
              link: document.sourceUrl,
              content: content
            })
            console.log('🔗 Added URL link with content length:', content.length)
          } else {
            // For other knowledge documents, add as text attachment
            const content = document.metadata?.content || document.description || ''
            if (content) {
              parsedAttachments.push({
                type: 'knowledge',
                title: document.title,
                text: content.slice(0, 8000), // Increased from 2000 to 8000 chars
              })
              console.log('📝 Added knowledge doc with content length:', content.length)
            } else {
              console.warn('⚠️  Knowledge document has no content:', document.title)
            }
          }
        } else {
          console.warn('⚠️  Knowledge document not found:', attachment.id)
        }
      } catch (error) {
        console.error('❌ Failed to load knowledge document:', attachment.id, error)
      }
    } else if (attachment.variant === 'chat') {
      // Handle chat attachments
      if (attachment.type === 'url') {
        links.push({ link: attachment.title || '' })
        console.log('🔗 Added chat URL:', attachment.title)
      } else if (attachment.fileKey) {
        // Handle file attachments - fetch actual content from file system/R2
        try {
          let fileContent = ''
          
          if (attachment.type === 'txt') {
            // For text files, we should fetch the content from R2/file system
            // For now, using title as placeholder - this needs file fetching implementation
            fileContent = attachment.title || ''
            console.log('📁 Text file attachment (using title for now):', attachment.title)
          } else if (attachment.type === 'pdf' || attachment.type === 'docx') {
            // For other document types, we'd need proper file processing
            // This should be implemented with file readers
            console.log('📄 Document file attachment (needs processing):', attachment.title)
          }
          
          if (fileContent) {
            parsedAttachments.push({
              type: attachment.type,
              title: attachment.title,
              text: fileContent.slice(0, 8000), // Increased limit
            })
          }
        } catch (error) {
          console.error('❌ Failed to process file attachment:', attachment.fileKey, error)
        }
      }
    }
  }

  console.log('✅ Parsing complete. Links:', links.length, 'Attachments:', parsedAttachments.length)
  return { links, attachments: parsedAttachments }
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

  // Enhanced chat endpoint with streaming support
  chat: protectedProcedure
    .input(
      z.object({
        message: z.any(),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { id, message } = input as { message: MyUIMessage; id: string }

      const limiter = new Ratelimit({ 
        redis, 
        limiter: Ratelimit.slidingWindow(80, '4h') 
      })

      console.log('🔄 Starting message processing for user:', user.email)
      console.log('📥 Input attachments:', message.metadata?.attachments?.length || 0)
      
      let parsedAttachments: { links: Array<{ link: string; content?: string }>; attachments: Array<{ type: string; text?: string; title?: string }> }
      let history: any
      let limitResult: any
      
      try {
        const [historyResult, attachmentResults, rateLimitResult] = await Promise.all([
          getMessagesFromRedis(id),
          parseAttachments({
            attachments: message.metadata?.attachments as TAttachment[],
            userId: user.id,
          }),
          limiter.limit(user.email),
        ])
        
        history = historyResult
        parsedAttachments = attachmentResults
        limitResult = rateLimitResult
        console.log('✅ Successfully processed all data')
        
      } catch (error) {
        console.error('❌ Error processing message data:', error)
        
        // Try to get at least history and rate limit, fallback for attachments
        try {
          const [historyResult, rateLimitResult] = await Promise.all([
            getMessagesFromRedis(id),
            limiter.limit(user.email),
          ])
          history = historyResult
          limitResult = rateLimitResult
        } catch (fallbackError) {
          console.error('❌ Fallback processing also failed:', fallbackError)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to process message data',
          })
        }
        
        // Use empty attachments if parsing failed
        parsedAttachments = { links: [], attachments: [] }
        console.log('⚠️  Continuing with empty attachments due to processing error')
      }

      if (process.env.NODE_ENV === 'production') {
        const { success } = limitResult
        if (!success) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Rate limit exceeded. Please try again later.',
          })
        }
      }

      const { links, attachments } = parsedAttachments

      console.log('🔨 Building AI content with:', {
        linksCount: links.length,
        attachmentsCount: attachments.length,
        linksWithContent: links.filter(l => l.content).length,
        attachmentsWithText: attachments.filter(a => a.text).length
      })

      // Build content for the AI
      let content = ''
      const userContent = message.parts.reduce(
        (acc, curr) => (curr.type === 'text' ? acc + curr.text : ''),
        '',
      )

      content += `<message date="${format(new Date(), 'EEEE, yyyy-MM-dd')}">`
      content += `<user_message>${userContent}</user_message>`

      if (Boolean(links.length)) {
        content += '<attached_links>'
        links.filter(Boolean).forEach((l) => {
          content += `<link url="${l.link}">`
          if (l.content) {
            content += `<content>${l.content}</content>`
            console.log('🔗 Including link content for:', l.link, 'length:', l.content.length)
          }
          content += `</link>`
        })
        content += '</attached_links>'
      }

      if (Boolean(attachments.length)) {
        content += '<attached_documents>'
        attachments.forEach((att) => {
          content += `<document type="${att.type}"`
          if (att.title) content += ` title="${att.title}"`
          content += `>`
          if (att.text) {
            content += `<content>${att.text}</content>`
            console.log('📄 Including document content for:', att.title, 'length:', att.text.length)
          }
          content += `</document>`
        })
        content += '</attached_documents>'
      }

      if (message.metadata?.tweets) {
        if (message.metadata.tweets.length === 1) {
          content += `<tweet_draft>${message.metadata.tweets[0]?.content}</tweet_draft>`
        } else if (message.metadata.tweets.length > 1) {
          content += '<thread_draft>'
          message.metadata.tweets.forEach((tweet) => {
            content += `<tweet_draft index="${tweet.index}">${tweet.content}</tweet_draft>`
          })
          content += '</thread_draft>'
        }
      }

      content += '</message>'

      console.log('🤖 Final AI content length:', content.length)
      console.log('📋 AI content preview:', content.substring(0, 500) + (content.length > 500 ? '...' : ''))

      const userMessage: MyUIMessage = {
        ...message,
        parts: [{ type: 'text' as const, text: content }, ...attachments.map(att => ({ ...att, type: att.type as any }))],
      }

      const messages = [...history, userMessage] as MyUIMessage[]

      const stream = createUIMessageStream<MyUIMessage>({
        originalMessages: messages,
        generateId: createIdGenerator({
          prefix: 'msg',
          size: 16,
        }),
        onFinish: async ({ messages }) => {
          await saveMessagesToRedis(id, messages)
          
          const historyKey = `chat:history-list:${user.email}`
          const existingHistory = await getChatHistoryList(user.email)
          
          const title = messages[0]?.metadata?.userMessage ?? 'Unnamed chat'
          
          const chatHistoryItem: ChatHistoryItem = {
            id,
            title,
            lastUpdated: new Date().toISOString(),
            messageCount: messages.length
          }
          
          const updatedHistory = [
            chatHistoryItem,
            ...existingHistory.filter((item) => item.id !== id),
          ]
          
          await saveChatHistoryList(user.email, updatedHistory)
        },
        onError(error) {
          console.log('❌❌❌ ERROR:', JSON.stringify(error, null, 2))
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Something went wrong.',
          })
        },
        execute: async ({ writer }) => {
          const generationId = crypto.randomUUID()
          
          // Create tweet tool with enhanced prompting
          const writeTweet = createTweetTool({
            writer,
            ctx: {
              userContent,
              messages,
              account: {
                name: user.name || 'User',
                username: user.email.split('@')[0],
              },
              style: {
                tone: 'casual',
                length: 'medium',
                includeEmojis: true,
                includeHashtags: false,
                targetAudience: 'tech community',
              },
            },
          })

          // Create website reading tool
          const readWebsiteContent = createReadWebsiteContentTool({
            conversationId: id,
          })
          
          // Get tweets from metadata (if any)
          const tweets = message.metadata?.tweets ?? []
          
          const result = streamText({
            model: openrouter.chat('anthropic/claude-3-5-sonnet-20241022', {
              reasoning: { enabled: false, effort: 'low' },
            }),
            system: assistantPrompt({ tweets }),
            messages: convertToModelMessages(messages),
            tools: { writeTweet, readWebsiteContent },
            stopWhen: stepCountIs(3),
            experimental_transform: smoothStream({
              delayInMs: 20,
              chunking: /[^-]*---/,
            }),
          })
          
          writer.merge(result.toUIMessageStream())
        },
      })
      
      return createUIMessageStreamResponse({ stream })
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

  // Delete a specific message from chat history
  deleteMessage: protectedProcedure
    .input(z.object({
      chatId: z.string(),
      messageId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { chatId, messageId } = input

      try {
        // Get current messages from Redis
        const messages = await getMessagesFromRedis(chatId)
        
        if (!messages || messages.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Chat not found',
          })
        }

        // Filter out the message to delete
        const updatedMessages = messages.filter(msg => msg.id !== messageId)
        
        if (updatedMessages.length === messages.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Message not found',
          })
        }

        // Save updated messages back to Redis
        await saveMessagesToRedis(chatId, updatedMessages)

        // Update chat history list if this was the last message
        if (messages.length > 0 && messages[messages.length - 1]?.id === messageId) {
          const title = updatedMessages.length > 0 
            ? (updatedMessages[0]?.metadata?.userMessage ?? 'Unnamed chat')
            : 'Empty chat'
          await updateChatHistoryList(user.email, chatId, title)
        }

        return { success: true, deletedMessageId: messageId }
      } catch (error) {
        console.error('Failed to delete message:', error)
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete message',
        })
      }
    }),

  // Regenerate AI response from a specific point
  regenerateMessage: protectedProcedure
    .input(z.object({
      chatId: z.string(),
      messageId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { chatId, messageId } = input

      try {
        // Get current messages from Redis
        const messages = await getMessagesFromRedis(chatId)
        
        if (!messages || messages.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Chat not found',
          })
        }

        // Find the message index
        const messageIndex = messages.findIndex(msg => msg.id === messageId)
        
        if (messageIndex === -1) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Message not found',
          })
        }

        // Keep messages up to (but not including) the message to regenerate
        const messagesToKeep = messages.slice(0, messageIndex)
        
        // Save the truncated messages
        await saveMessagesToRedis(chatId, messagesToKeep)

        // Return the last user message for re-processing
        const lastUserMessage = messagesToKeep.findLast(msg => msg.role === 'user')
        
        return { 
          success: true, 
          truncatedAt: messageId,
          messagesToKeep: messagesToKeep.length,
          lastUserMessage: lastUserMessage?.parts?.[0]?.type === 'text' ? lastUserMessage.parts[0].text : null
        }
      } catch (error) {
        console.error('Failed to regenerate message:', error)
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to regenerate message',
        })
      }
    }),

  // Update conversation title
  updateConversationTitle: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      title: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { conversationId, title } = input

      try {
        // Update the chat history list
        const existingHistory = await getChatHistoryList(user.email)
        const updatedHistory = existingHistory.map(item => 
          item.id === conversationId 
            ? { ...item, title: title.slice(0, 50) + (title.length > 50 ? '...' : '') }
            : item
        )

        if (updatedHistory.length === existingHistory.length && 
            !updatedHistory.some(item => item.id === conversationId)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Conversation not found',
          })
        }

        await saveChatHistoryList(user.email, updatedHistory)

        return { 
          success: true, 
          conversationId, 
          title: title.slice(0, 50) + (title.length > 50 ? '...' : '')
        }
      } catch (error) {
        console.error('Failed to update conversation title:', error)
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update conversation title',
        })
      }
    }),
})