'use client'

import { memo, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageWrapper } from './message-wrapper'
import { LoadingMessage } from './loading-message'
import { TweetMockup } from './tweet-mockup'
import { StreamingMessage } from './streaming-message'
import ReactMarkdown from 'react-markdown'
import { ChatStatus } from 'ai'

interface MessagesProps {
  messages: any[] // Use AI SDK message type like contentport-main
  status: ChatStatus
  error?: Error
}

export const Messages = memo(({ messages, status, error }: MessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const lastUserMessageIndex = useMemo(
    () => messages.findLastIndex((m) => m.role === 'user'),
    [messages],
  )

  const visibleMessages = useMemo(
    () =>
      messages.filter((message) =>
        message.parts?.some((part: any) => part.type === 'text' && Boolean(part.text)) || 
        Boolean(message.content)
      ),
    [messages],
  )

  const showLoadingMessage = useMemo(() => {
    return (
      !error &&
      (status === 'submitted' ||
        (status === 'streaming' &&
          !Boolean(
            messages[messages.length - 1]?.parts?.some(
              (part: any) => part.type === 'text' && Boolean(part.text),
            ) || messages[messages.length - 1]?.content
          )))
    )
  }, [error, status, messages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const hasImageAttachment = useMemo(() => {
    return Boolean(
      messages[lastUserMessageIndex]?.metadata?.attachments?.some(
        (a: any) => a.type === 'image',
      ),
    )
  }, [messages, lastUserMessageIndex])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {visibleMessages.map((message, index) => {
        const isUser = message.role === 'user'
        
        return (
          <div
            key={message.id}
            data-message-index={index}
            data-message-role={message.role}
            className="flex gap-3 group"
          >
            <div className="flex-shrink-0">
              {isUser ? (
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className={`flex-1 ${isUser ? 'bg-blue-500 text-white rounded-2xl px-4 py-3' : 'bg-white border border-gray-200 rounded-2xl px-4 py-3'}`}>
              {message.parts ? (
                message.parts.map((part: any, i: number) => {
                  if (part.type === 'tool-readWebsiteContent') {
                    if (
                      part.state === 'input-available' ||
                      part.state === 'input-streaming'
                    ) {
                      return <div key={i}>Website loading...</div>
                    }

                    if (part.output) {
                      return (
                        <div key={i}>
                          <h3>{part.output.title}</h3>
                          <ReactMarkdown>
                            {part.output.content.slice(0, 250)}
                          </ReactMarkdown>
                        </div>
                      )
                    }

                    return null
                  }

                  if (part.type === 'data-tool-output') {
                    if (part.data.status === 'processing') {
                      return <TweetMockup key={i} isLoading />
                    }

                    return (
                      <TweetMockup key={i} text={part.data.text}>
                        <StreamingMessage content={part.data.text} />
                      </TweetMockup>
                    )
                  }

                  if (part.type === 'text') {
                    if (!part.text) return null

                    return (
                      <div className="whitespace-pre-wrap" key={i}>
                        <StreamingMessage
                          content={message.metadata?.userMessage || part.text}
                          isStreaming={message.role === 'assistant' && index === messages.length - 1}
                        />
                      </div>
                    )
                  }

                  return null
                })
              ) : message.content ? (
                <div className="whitespace-pre-wrap">
                  <StreamingMessage
                    content={message.content}
                    isStreaming={message.role === 'assistant' && index === messages.length - 1}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )
      })}

      {showLoadingMessage && (
        <div data-message-index={visibleMessages.length} data-loading="true">
          <LoadingMessage hasAttachments={hasImageAttachment} />
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
})

Messages.displayName = 'Messages'