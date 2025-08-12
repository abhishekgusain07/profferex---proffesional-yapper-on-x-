'use client'

import { createContext, useContext, PropsWithChildren, useMemo, useEffect, useCallback, useRef } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import { nanoid } from 'nanoid'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import type { ChatMessage, ChatContextType, MessageMetadata } from '@/types/chat'

const ChatContext = createContext<ChatContextType | null>(null)

// Stable reference for empty messages array
const EMPTY_MESSAGES = { messages: [] }

// Message comparison function to prevent unnecessary updates
function areMessagesEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  return a.every((msg, index) => {
    const otherMsg = b[index]
    const msgTyped = msg as { id: string; content: string; role: string }
    const otherMsgTyped = otherMsg as { id: string; content: string; role: string }
    return msgTyped.id === otherMsgTyped.id && 
           msgTyped.content === otherMsgTyped.content && 
           msgTyped.role === otherMsgTyped.role
  })
}

interface ChatProviderProps extends PropsWithChildren {
  initialConversationId?: string
}

export function ChatProvider({ children, initialConversationId }: ChatProviderProps) {
  // Stabilize chatId across renders
  const chatIdRef = useRef<string>(initialConversationId ?? nanoid())
  const chatId = chatIdRef.current

  const chat = useChat<any>({
    id: chatId,
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

  const { data } = useQuery({
    queryKey: ['initial-messages', chatId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/get_message_history?chatId=${chatId}`)
      return (await res.json()) as { messages: unknown[] }
    },
    initialData: EMPTY_MESSAGES,
  })

  // Track previous messages to prevent unnecessary updates
  const prevMessagesRef = useRef<unknown[]>([])

  useEffect(() => {
    if (data?.messages && !areMessagesEqual(prevMessagesRef.current, data.messages)) {
      prevMessagesRef.current = data.messages
      chat.setMessages(data.messages as never[])
    }
  }, [data?.messages, chat])

  // Memoize message transformation to prevent unnecessary recalculations
  const transformedMessages = useMemo(() => {
    return (chat.messages as { id: string; role: string; content?: string; parts?: { type: string; text: string }[]; metadata?: MessageMetadata }[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.parts?.map((p) => (p.type === 'text' ? p.text : '')).join('') ?? m.content ?? '',
      metadata: m.metadata as MessageMetadata | undefined,
      chatId: chatId,
      createdAt: new Date(),
    })) as ChatMessage[]
  }, [chat.messages, chatId])

  // Memoize callback functions to prevent unnecessary re-renders
  const sendMessage = useCallback(async (content: string, metadata?: MessageMetadata) => {
    await chat.sendMessage({ text: content, metadata } as never)
  }, [chat])

  const clearChat = useCallback(() => {
    chat.setMessages([] as never[])
    prevMessagesRef.current = []
  }, [chat])

  const stop = useCallback(() => {
    chat.stop()
  }, [chat])

  const contextValue: ChatContextType = useMemo(() => ({
    conversationId: chatId,
    messages: transformedMessages,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isStreaming: chat.status === 'streaming',
    error: null,
    sendMessage,
    regenerateResponse: async () => {},
    clearChat,
    startNewConversation: () => {},
    loadConversation: async () => {},
    deleteMessage: async () => {},
    editMessage: async () => {},
    stop,
  }), [chatId, transformedMessages, chat.status, sendMessage, clearChat, stop])

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
  return {
    conversations: [],
    isLoading: false,
    hasMore: false,
    total: 0,
    deleteConversation: async () => {},
    loadMore: () => {},
    refetch: async () => {},
  }
}

export function useChatRateLimit() {
  return { rateLimit: null, refetch: async () => {} }
}