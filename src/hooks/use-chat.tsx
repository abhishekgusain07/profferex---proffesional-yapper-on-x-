'use client'

import { createContext, useContext, PropsWithChildren, useMemo, useEffect, useCallback } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import { nanoid } from 'nanoid'
import { useQueryState } from 'nuqs'
import { trpc } from '@/trpc/client'
import toast from 'react-hot-toast'

import type { ChatMessage, ChatContextType, MessageMetadata } from '@/types/chat'

const ChatContext = createContext<ChatContextType | null>(null)


interface ChatProviderProps extends PropsWithChildren {
  initialConversationId?: string
}

const defaultValue = nanoid()

export function ChatProvider({ children }: ChatProviderProps) {
  const [id, setId] = useQueryState('chatId', {
    defaultValue,
  })

  const startNewChat = async (newId?: string) => {
    const chatId = newId || nanoid()
    setId(chatId)
  }

  const chat = useChat<any>({
    id,
    transport: new DefaultChatTransport({
      api: '/api/chat/chat',
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } }
      },
    }),
    messages: [],
    onError: ({ message }) => {
      toast.error(message)
    },
  })

  const { data, error: queryError, isLoading: queryLoading } = trpc.chat.get_message_history.useQuery(
    { chatId: id },
    {
      initialData: { messages: [] },
      refetchOnWindowFocus: false,
    }
  )

  useEffect(() => {
    if (queryError) {
      return
    }
    
    if (data?.messages) {
      chat.setMessages(data.messages as never[])
    } else {
      // Ensure we clear messages when switching to a chat with no messages
      chat.setMessages([] as never[])
    }
  }, [data, id, queryError, queryLoading])

  // Memoize message transformation to prevent unnecessary recalculations
  const transformedMessages = useMemo(() => {
    return (chat.messages as { id: string; role: string; content?: string; parts?: { type: string; text: string; data?: any }[]; metadata?: MessageMetadata }[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.parts?.map((p) => (p.type === 'text' ? p.text : '')).join('') ?? m.content ?? '',
      parts: m.parts || [], // Preserve original parts structure for Messages component
      metadata: m.metadata as MessageMetadata | undefined,
      chatId: id,
      createdAt: new Date(),
    })) as ChatMessage[]
  }, [chat.messages, id])

  // Memoize callback functions to prevent unnecessary re-renders
  const sendMessage = useCallback(async (content: string, metadata?: MessageMetadata) => {
    await chat.sendMessage({ text: content, metadata } as never)
  }, [chat])

  const clearChat = useCallback(() => {
    chat.setMessages([] as never[])
  }, [chat])

  const stop = useCallback(() => {
    chat.stop()
  }, [chat])

  const loadConversation = useCallback(async (conversationId: string) => {
    setId(conversationId)
    // The useQuery will automatically refetch with the new id
  }, [setId])

  const stopGeneration = useCallback(() => {
    chat.stop()
  }, [chat])

  const contextValue = useMemo(() => ({ 
    ...chat, 
    startNewChat, 
    setId: async (newId: string) => { setId(newId) },
    conversationId: id,
    id: id, // Add id for compatibility 
    messages: transformedMessages,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isStreaming: chat.status === 'streaming',
    status: chat.status === 'submitted' || chat.status === 'streaming' ? 'loading' : 'idle',
    error: null,
    sendMessage,
    regenerateResponse: async () => {},
    clearChat,
    startNewConversation: startNewChat,
    loadConversation,
    deleteMessage: async () => {},
    editMessage: async () => {},
    stop,
    stopGeneration,
  }), [chat, startNewChat, setId, id, transformedMessages, sendMessage, clearChat, loadConversation, stop, stopGeneration])

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  )
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChatContext must be used within a ChatProvider')
  return context
}

export function useChatConversations() {
  const { data, isLoading, refetch } = trpc.chat.history.useQuery()
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation()

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await deleteConversationMutation.mutateAsync({ conversationId })
      await refetch()
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }, [deleteConversationMutation, refetch])

  return {
    conversations: data?.chatHistory || [],
    isLoading,
    hasMore: false,
    total: data?.chatHistory?.length || 0,
    deleteConversation,
    loadMore: () => {},
    refetch,
  }
}

export function useChatRateLimit() {
  return { rateLimit: null, refetch: async () => {} }
}