'use client'

import { memo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '@/types/chat'
import { MessageWrapper } from './message-wrapper'
import { LoadingMessage } from './loading-message'
import { Loader } from '@/components/ui/loader'
import { TweetMockup } from './tweet-mockup'
import { StreamingMessage } from './streaming-message'
import ReactMarkdown from 'react-markdown'

interface MessagesProps {
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  error?: string | null
  className?: string
}

export const Messages = memo(({ messages, isLoading, isStreaming, error, className }: MessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)


  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Show empty state if no messages
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-gray-500">
              Ask me to help you create engaging tweets, brainstorm ideas, or improve your content.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 ${className || ''}`}
      style={{ height: '100%', maxHeight: '100%' }}
    >
      <AnimatePresence mode="popLayout">
        {messages.map((message, index) => {
          // Handle AI SDK message format with parts
          const aiMessage = message as any
          const isUser = message.role === 'user'
          
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              {/* Check if message has parts (AI SDK format) */}
              {aiMessage.parts && Array.isArray(aiMessage.parts) ? (
                <div className={`group flex gap-3 relative ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {/* Avatar for assistant messages */}
                  {!isUser && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex-1 max-w-[80%] space-y-3 ${isUser && 'flex justify-end'}`}>
                    {aiMessage.parts.map((part: any, partIndex: number) => {
                      // Handle data-tool-output parts (tweet mockups)
                      if (part.type === 'data-tool-output') {
                        if (part.data.status === 'processing') {
                          return <TweetMockup key={partIndex} isLoading />
                        }
                        
                        return (
                          <TweetMockup key={partIndex} text={part.data.text}>
                            <StreamingMessage content={part.data.text} />
                          </TweetMockup>
                        )
                      }
                      
                      // Handle text parts
                      if (part.type === 'text' && part.text) {
                        return (
                          <div 
                            key={partIndex}
                            className={`rounded-2xl px-4 py-3 shadow-sm ${
                              isUser 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-white border border-gray-200 text-gray-900'
                            }`}
                          >
                            <StreamingMessage 
                              content={part.text}
                              isStreaming={index === messages.length - 1 && message.role === 'assistant'}
                            />
                          </div>
                        )
                      }
                      
                      return null
                    })}
                  </div>
                  
                  {/* Avatar for user messages */}
                  {isUser && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback to old MessageWrapper for messages without parts */
                <MessageWrapper 
                  message={message}
                  isLast={index === messages.length - 1}
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Loading indicator for when AI is responding */}
      {(isLoading || isStreaming) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <LoadingMessage />
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <div className="flex items-start space-x-2">
            <svg 
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-800">
                Something went wrong
              </h4>
              <p className="text-sm text-red-700 mt-1">
                {error}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
})

Messages.displayName = 'Messages'