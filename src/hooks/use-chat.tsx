'use client'

import { createContext, useContext, PropsWithChildren, useMemo, useEffect, useCallback, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import { nanoid } from 'nanoid'
import { useQueryState, Options } from 'nuqs'
import { trpc } from '@/trpc/client'
import toast from 'react-hot-toast'

// Enhanced interface with thread support and contentport patterns
interface ChatContext extends ReturnType<typeof useChat> {
  startNewChat: (id?: string) => Promise<void>
  setId: (
    value: string | ((old: string) => string | null) | null,
    options?: Options,
  ) => Promise<URLSearchParams>
  id: string
  isLoading: boolean
  isStreaming: boolean
  regenerateResponse: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  // Thread-specific functionality
  isGeneratingThread: boolean
  lastThreadCount: number
  threadGenerationProgress: { current: number; total: number } | null
  // Enhanced state management
  conversationTitle: string | null
  lastActivity: Date | null
}

const ChatContext = createContext<ChatContext | null>(null)

const defaultValue = nanoid()

export function ChatProvider({ children }: PropsWithChildren) {
  const [id, setId] = useQueryState('chatId', {
    defaultValue,
  })
  
  // Enhanced state for thread support
  const [isGeneratingThread, setIsGeneratingThread] = useState(false)
  const [lastThreadCount, setLastThreadCount] = useState(0)
  const [threadGenerationProgress, setThreadGenerationProgress] = useState<{ current: number; total: number } | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)
  const [lastActivity, setLastActivity] = useState<Date | null>(null)

  const startNewChat = async (newId?: string) => {
    const newChatId = newId || nanoid()
    setId(newChatId)
    setIsGeneratingThread(false)
    setLastThreadCount(0)
    setThreadGenerationProgress(null)
    setConversationTitle(null)
    setLastActivity(new Date())
  }

  // Enhanced tRPC mutations for message management - TODO: Implement in Phase 2
  // const deleteChatMessageMutation = trpc.chat.deleteMessage.useMutation()
  // const regenerateMessageMutation = trpc.chat.regenerateMessage.useMutation()

  const chat = useChat({
    id,
    transport: new DefaultChatTransport({
      api: '/api/chat/chat',
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } }
      },
    }),
    messages: [],
    onError: ({ message, error }) => {
      console.error('Chat error:', error)
      toast.error(message || 'An error occurred')
      setIsGeneratingThread(false)
      setThreadGenerationProgress(null)
    },
    onFinish: (message) => {
      setLastActivity(new Date())
      
      // Detect thread generation
      const hasThreadIndicator = message.content.includes('---') || 
                                  message.content.toLowerCase().includes('thread') ||
                                  message.parts?.some(part => 
                                    part.type === 'data-tool-output' && 
                                    part.data?.text?.includes('---')
                                  )
      
      if (hasThreadIndicator) {
        const threadCount = (message.content.match(/---/g) || []).length + 1
        setLastThreadCount(threadCount)
        setIsGeneratingThread(false)
        setThreadGenerationProgress(null)
      }
      
      // Auto-generate conversation title from first exchange
      if (!conversationTitle && chat.messages.length <= 2) {
        const userMessage = chat.messages.find(m => m.role === 'user')
        if (userMessage?.content) {
          const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '')
          setConversationTitle(title)
        }
      }
    },
    onStreamEvent: (event) => {
      // Enhanced streaming event handling
      if (event.type === 'tool-call' && event.toolName === 'createTweet') {
        setIsGeneratingThread(true)
        // You can add more sophisticated progress tracking here
      }
      
      if (event.type === 'tool-result') {
        setThreadGenerationProgress(null)
      }
    }
  })

  const { data } = trpc.chat.get_message_history.useQuery(
    { chatId: id },
    {
      enabled: !!id && id !== defaultValue,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  )

  useEffect(() => {
    if (data?.messages) {
      chat.setMessages(data.messages as never[])
      
      // Restore conversation metadata
      if (data.title) setConversationTitle(data.title)
      if (data.lastActivity) setLastActivity(new Date(data.lastActivity))
    } else if (id === defaultValue) {
      // Reset to empty messages when on default/new chat
      chat.setMessages([])
      setConversationTitle(null)
      setLastActivity(null)
    }
  }, [data, chat.setMessages, id, defaultValue])

  // Enhanced message management functions
  const regenerateResponse = useCallback(async (messageId: string) => {
    try {
      const messageIndex = chat.messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return

      // Remove assistant message and all subsequent messages
      const messagesToKeep = chat.messages.slice(0, messageIndex)
      chat.setMessages(messagesToKeep)

      // Regenerate from the last user message
      const lastUserMessage = messagesToKeep.findLast(m => m.role === 'user')
      if (lastUserMessage) {
        setIsGeneratingThread(true)
        await chat.sendMessage({ content: lastUserMessage.content })
      }
    } catch (error) {
      console.error('Failed to regenerate:', error)
      toast.error('Failed to regenerate response')
    }
  }, [chat, chat.messages, chat.setMessages])

  const deleteMessage = useCallback(async (messageId: string) => {
    // TODO: Implement in Phase 2 - deleteMessage endpoint
    console.log('deleteMessage called with:', messageId)
    toast.error('Message deletion will be available soon!')
    return Promise.resolve()
  }, [])

  const contextValue = useMemo(() => ({ 
    ...chat, 
    startNewChat, 
    setId,
    id,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isStreaming: chat.status === 'streaming',
    regenerateResponse,
    deleteMessage,
    // Thread-specific state
    isGeneratingThread,
    lastThreadCount,
    threadGenerationProgress,
    // Enhanced state
    conversationTitle,
    lastActivity,
  }), [
    chat, 
    startNewChat, 
    setId, 
    id,
    regenerateResponse,
    deleteMessage,
    isGeneratingThread,
    lastThreadCount,
    threadGenerationProgress,
    conversationTitle,
    lastActivity
  ])

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChatContext must be used within a ChatProvider')
  return context
}

export function useChatConversations() {
  const { data, isLoading, refetch } = trpc.chat.history.useQuery()
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation()
  // const updateConversationMutation = trpc.chat.updateConversation.useMutation() // TODO: Implement in Phase 2

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await deleteConversationMutation.mutateAsync({ conversationId })
      await refetch()
      toast.success('Conversation deleted')
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }, [deleteConversationMutation, refetch])

  const updateConversationTitle = useCallback(async (conversationId: string, title: string) => {
    // TODO: Implement in Phase 2 - updateConversation endpoint
    console.log('updateConversationTitle called with:', { conversationId, title })
    toast.error('Conversation title update will be available soon!')
    return Promise.resolve()
  }, [])

  // Enhanced conversation data with thread detection
  const processedConversations = useMemo(() => {
    return (data?.chatHistory || []).map(conversation => ({
      ...conversation,
      hasThreads: conversation.lastMessage?.includes('---') || false,
      threadCount: (conversation.lastMessage?.match(/---/g) || []).length + 1,
      isThreadConversation: (conversation.lastMessage?.match(/---/g) || []).length > 0,
    }))
  }, [data?.chatHistory])

  return {
    conversations: processedConversations,
    isLoading,
    hasMore: false,
    total: processedConversations.length,
    deleteConversation,
    updateConversationTitle,
    loadMore: () => {},
    refetch,
  }
}

export function useChatRateLimit() {
  const { data, isLoading, refetch } = trpc.chat.getRateLimit.useQuery(undefined, {
    enabled: false, // Only fetch when explicitly called
    refetchOnWindowFocus: false,
  })

  const checkRateLimit = useCallback(async () => {
    await refetch()
  }, [refetch])

  return { 
    rateLimit: data?.rateLimit || null, 
    isLoading,
    refetch: checkRateLimit 
  }
}