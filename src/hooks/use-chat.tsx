'use client'

import { createContext, useContext, useState, useCallback, useEffect, PropsWithChildren } from 'react'
import { trpc } from '@/trpc/client'
import { nanoid } from 'nanoid'
import type { 
  ChatMessage, 
  MessageMetadata, 
  ChatContextType,
  ChatHistoryItem 
} from '@/types/chat'
import toast from 'react-hot-toast'

const ChatContext = createContext<ChatContextType | null>(null)

interface ChatProviderProps extends PropsWithChildren {
  initialConversationId?: string
}

export function ChatProvider({ children, initialConversationId }: ChatProviderProps) {
  // State
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // tRPC hooks
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const createConversationMutation = trpc.chat.createConversation.useMutation()
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation()
  
  const { data: conversationHistory } = trpc.chat.getHistory.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  )

  // Load conversation history when conversation changes
  useEffect(() => {
    if (conversationHistory?.messages) {
      setMessages(conversationHistory.messages)
    }
  }, [conversationHistory])

  // Send message function
  const sendMessage = useCallback(async (content: string, metadata?: MessageMetadata) => {
    if (!content.trim()) return

    setIsLoading(true)
    setIsStreaming(true)
    setError(null)

    try {
      const result = await sendMessageMutation.mutateAsync({
        content: content.trim(),
        conversationId: conversationId || undefined,
        metadata,
      })

      // Update conversation ID if it was created
      if (!conversationId) {
        setConversationId(result.conversationId)
      }

      // Add both messages to state optimistically
      setMessages(prev => [
        ...prev,
        result.userMessage,
        result.assistantMessage,
      ])

    } catch (err: any) {
      console.error('Failed to send message:', err)
      const errorMessage = err.message || 'Failed to send message. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [conversationId, sendMessageMutation])

  // Regenerate response function
  const regenerateResponse = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]
    if (message.role !== 'assistant') return

    // Find the previous user message
    let userMessage: ChatMessage | null = null
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i]
        break
      }
    }

    if (!userMessage) return

    // Remove the assistant message we're regenerating
    setMessages(prev => prev.filter(msg => msg.id !== messageId))

    // Resend the user message
    await sendMessage(userMessage.content, userMessage.metadata)
  }, [messages, sendMessage])

  // Clear chat function
  const clearChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  // Start new conversation
  const startNewConversation = useCallback(async () => {
    try {
      const result = await createConversationMutation.mutateAsync()
      setConversationId(result.conversationId)
      setMessages([])
      setError(null)
    } catch (err: any) {
      console.error('Failed to create conversation:', err)
      toast.error('Failed to create new conversation')
    }
  }, [createConversationMutation])

  // Load conversation
  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id)
    setMessages([])
    setError(null)
    // Messages will be loaded via the useQuery hook
  }, [])

  // Delete message function
  const deleteMessage = useCallback(async (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
    // TODO: Implement server-side message deletion if needed
  }, [])

  // Edit message function
  const editMessage = useCallback(async (messageId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, content } : msg
    ))
    // TODO: Implement server-side message editing if needed
  }, [])

  // Stop streaming (not implemented yet, but placeholder)
  const stop = useCallback(() => {
    setIsStreaming(false)
    setIsLoading(false)
  }, [])

  const contextValue: ChatContextType = {
    conversationId,
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    regenerateResponse,
    clearChat,
    startNewConversation,
    loadConversation,
    deleteMessage,
    editMessage,
    stop,
  }

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext)
  
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  
  return context
}

// Additional hook for managing chat conversations list
export function useChatConversations() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { 
    data: conversationsData, 
    isLoading, 
    refetch 
  } = trpc.chat.getConversations.useQuery({
    limit,
    offset: page * limit,
  })

  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      refetch()
      toast.success('Conversation deleted')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete conversation')
    }
  })

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      await deleteConversationMutation.mutateAsync({ conversationId })
    }
  }, [deleteConversationMutation])

  const loadMore = useCallback(() => {
    if (conversationsData?.hasMore) {
      setPage(prev => prev + 1)
    }
  }, [conversationsData?.hasMore])

  return {
    conversations: conversationsData?.conversations || [],
    isLoading,
    hasMore: conversationsData?.hasMore || false,
    total: conversationsData?.total || 0,
    deleteConversation,
    loadMore,
    refetch,
  }
}

// Hook for getting rate limit information
export function useChatRateLimit() {
  const { data: rateLimit, refetch } = trpc.chat.getRateLimit.useQuery()

  return {
    rateLimit,
    refetch,
  }
}