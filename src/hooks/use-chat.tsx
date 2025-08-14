'use client'

import { createContext, useContext, PropsWithChildren, useMemo, useEffect, useCallback, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import { nanoid } from 'nanoid'
import { useQueryState, Options } from 'nuqs'
import { trpc } from '@/trpc/client'
import toast from 'react-hot-toast'

// Simplified interface that extends useChat return type like contentport-main
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
}

const ChatContext = createContext<ChatContext | null>(null)

const defaultValue = nanoid()

export function ChatProvider({ children }: PropsWithChildren) {
  const [id, setId] = useQueryState('chatId', {
    defaultValue,
  })

  const startNewChat = async (newId?: string) => {
    setId(newId || nanoid())
  }

  const chat = useChat({
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
    } else if (id === defaultValue) {
      // Reset to empty messages when on default/new chat
      chat.setMessages([])
    }
  }, [data, chat.setMessages, id, defaultValue])

  const contextValue = useMemo(() => ({ 
    ...chat, 
    startNewChat, 
    setId,
    id,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isStreaming: chat.status === 'streaming',
    regenerateResponse: async (messageId: string) => {},
    deleteMessage: async (messageId: string) => {},
  }), [chat, startNewChat, setId, id])

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