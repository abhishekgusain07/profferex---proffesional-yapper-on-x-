'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, RotateCcw, Trash2, FileText, User, Bot } from 'lucide-react'
import type { ChatMessage } from '@/types/chat'
import { useChatContext } from '@/hooks/use-chat'
import { StreamingMessage } from './streaming-message'
import { TweetMockup } from './tweet-mockup'
import { WebsiteMockup } from './website-mockup'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'

interface MessageWrapperProps {
  message: ChatMessage
  isLast: boolean
}

export function MessageWrapper({ message, isLast }: MessageWrapperProps) {
  const { regenerateResponse, 
    deleteMessage } = useChatContext()
  const [showActions, setShowActions] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Parse website content from message
  const parseWebsiteContent = (content: string) => {
    const websiteMatches = content.match(/\[WEBSITE_CONTENT\]([\s\S]*?)\[\/WEBSITE_CONTENT\]/)
    if (!websiteMatches) return { content, websiteContent: null }
    
    const cleanContent = content.replace(/\[WEBSITE_CONTENT\][\s\S]*?\[\/WEBSITE_CONTENT\]/, '').trim()
    
    try {
      const websiteData = JSON.parse(websiteMatches[0].replace(/\[WEBSITE_CONTENT\]|\[\/WEBSITE_CONTENT\]/g, ''))
      return { content: cleanContent, websiteContent: websiteData }
    } catch {
      return { content, websiteContent: null }
    }
  }

  const { content: displayContent, websiteContent } = parseWebsiteContent(message.content)

  // Check if message contains a tweet (simple heuristic)
  const containsTweet = isAssistant && (
    displayContent.includes('Tweet:') ||
    displayContent.includes('🐦') ||
    (displayContent.length <= 280 && displayContent.includes('#'))
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      toast.success('Message copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy message')
    }
  }

  const handleRegenerate = async () => {
    if (!isAssistant) return
    
    setIsRegenerating(true)
    try {
      await regenerateResponse(message.id)
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      await deleteMessage(message.id)
      toast.success('Message deleted')
    }
  }

  return (
    <motion.div
      className={cn(
        'group flex gap-3 relative',
        isUser ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar for assistant messages */}
      {isAssistant && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Message content */}
      <div className={cn(
        'flex-1 max-w-[80%]',
        isUser && 'flex justify-end'
      )}>
        <div className={cn(
          'relative rounded-2xl px-4 py-3 shadow-sm',
          isUser 
            ? 'bg-blue-500 text-white ml-12' 
            : 'bg-white border border-gray-200 text-gray-900'
        )}>
          {/* Message metadata */}
          {message.metadata?.attachments && message.metadata.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {message.metadata.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                    isUser 
                      ? 'bg-blue-400 text-blue-100' 
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  <FileText className="w-3 h-3" />
                  {attachment.title || 'Attachment'}
                </div>
              ))}
            </div>
          )}

          {/* Message content with streaming, tweet, or website display */}
          <div className="space-y-3">
            {/* Website content preview */}
            {websiteContent && (
              <WebsiteMockup
                url={websiteContent.url}
                title={websiteContent.title}
              >
                <div className="line-clamp-3">
                  <ReactMarkdown>
                    {websiteContent.content.slice(0, 250) + (websiteContent.content.length > 250 ? '...' : '')}
                  </ReactMarkdown>
                </div>
              </WebsiteMockup>
            )}
            
            {/* Main message content */}
            {displayContent && (
              containsTweet ? (
                <TweetMockup content={displayContent} />
              ) : (
                <StreamingMessage 
                  content={displayContent}
                  isStreaming={isLast && message.role === 'assistant'}
                />
              )
            )}
          </div>

          {/* Timestamp */}
          <div className={cn(
            'text-xs mt-2 opacity-60',
            isUser ? 'text-blue-100' : 'text-gray-500'
          )}>
            {new Date(message.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>

        {/* Message actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute top-0 flex items-center gap-1 z-10',
                isUser 
                  ? '-left-20' 
                  : '-right-20'
              )}
            >
              <TooltipProvider>
                {/* Copy button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border border-gray-200"
                      onClick={handleCopy}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy message</p>
                  </TooltipContent>
                </Tooltip>

                {/* Regenerate button (only for assistant messages) */}
                {isAssistant && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border border-gray-200"
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                      >
                        <RotateCcw className={cn(
                          "w-3 h-3",
                          isRegenerating && "animate-spin"
                        )} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regenerate response</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Delete button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-white shadow-md hover:bg-red-50 border border-gray-200 text-red-500 hover:text-red-600"
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete message</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Avatar for user messages */}
      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-gray-600" />
          </div>
        </div>
      )}
    </motion.div>
  )
}