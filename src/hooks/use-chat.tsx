'use client'

import { createContext, useContext, PropsWithChildren, useMemo, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { nanoid } from 'nanoid'
import { useQueryState, Options } from 'nuqs'
import { trpc } from '@/trpc/client'
import toast from 'react-hot-toast'
import { MyUIMessage } from '@/trpc/routers/chat'
import { DefaultChatTransport } from 'ai'

// Simplified interface matching contentport pattern
interface ChatContext extends ReturnType<typeof useChat<MyUIMessage>> {
  startNewChat: (id?: string) => Promise<void>
  setId: (
    value: string | ((old: string) => string | null) | null,
    options?: Options,
  ) => Promise<URLSearchParams>
  id: string
}

const ChatContext = createContext<ChatContext | null>(null)

const defaultValue = nanoid()

export const ChatProvider = ({ children }: PropsWithChildren) => {
  const [id, setId] = useQueryState('chatId', {
    defaultValue,
  })

  const startNewChat = async (id?: string) => {
    setId(nanoid())
  }

  const chat = useChat<MyUIMessage>({
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
    }
  )

  useEffect(() => {
    if (data?.messages) {
      chat.setMessages(data.messages)
    }
  }, [data, chat.setMessages])

  const contextValue = useMemo(() => ({ 
    ...chat, 
    startNewChat, 
    setId,
    id
  }), [chat, startNewChat, setId, id])

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }

  return context
}