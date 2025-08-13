'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Paperclip, X, Square, Loader2 } from 'lucide-react'
import { useChatContext } from '@/hooks/use-chat'
import { useAttachments, useFileHandler } from '@/hooks/use-attachments'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AttachmentItem } from './attachment-item'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  placeholder?: string
  maxLength?: number
  className?: string
}

export function ChatInput({ 
  placeholder = "Ask about creating tweets, content ideas, or anything else...",
  maxLength = 4000,
  className 
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { sendMessage, isLoading, isStreaming, stop } = useChatContext()
  const { attachments, hasUploading, clearAttachments } = useAttachments()
  const { handleDrop, handlePaste, handleFileSelect } = useFileHandler()

  const isDisabled = isLoading || isStreaming || hasUploading
  const canSend = message.trim().length > 0 && !isDisabled

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 200) // Max height of 200px
      textarea.style.height = `${newHeight}px`
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustTextareaHeight()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSendMessage = async () => {
    if (!canSend) return

    const messageContent = message.trim()
    const messageAttachments = attachments.length > 0 ? attachments : undefined

    // Clear input and attachments immediately for better UX
    setMessage('')
    clearAttachments()
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      sendMessage({
        text: messageContent,
        metadata: {
          attachments: messageAttachments,
          userMessage: messageContent
        }
      })
    } catch (error) {
      // Error is handled by the chat context
      console.error('Failed to send message:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleDrop(e)
  }

  const handleAttachFiles = () => {
    fileInputRef.current?.click()
  }

  const handleStop = () => {
    stop()
  }

  return (
    <div className={cn('relative', className)}>
      {/* Attachments Display */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <AttachmentItem 
                  key={attachment.id} 
                  attachment={attachment}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Container */}
      <div
        className={cn(
          'relative transition-all duration-200 ease-out',
          isDragging && 'ring-2 ring-blue-500 ring-offset-2'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-50/90 backdrop-blur-sm rounded-xl z-20 flex items-center justify-center border-2 border-dashed border-blue-300">
            <div className="text-center">
              <Paperclip className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-700">Drop files to attach</p>
              <p className="text-xs text-blue-600">Images, documents, and more</p>
            </div>
          </div>
        )}

        {/* Input Container */}
        <div className={cn(
          'relative bg-white border-2 border-gray-200 rounded-xl shadow-sm transition-all duration-200',
          'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
          isDragging && 'border-blue-300',
          isDisabled && 'opacity-75'
        )}>
          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={isDisabled}
            maxLength={maxLength}
            className={cn(
              'min-h-[3rem] max-h-[200px] resize-none border-none outline-none ring-0 focus-visible:ring-0',
              'bg-transparent px-4 py-3 pr-20 text-base',
              'placeholder:text-gray-400'
            )}
            style={{ height: 'auto' }}
          />

          {/* Bottom Bar */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              {/* File Attachment Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAttachFiles}
                      disabled={isDisabled}
                      className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attach files</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Character Count */}
              {message.length > 0 && (
                <span className={cn(
                  'text-xs',
                  message.length > maxLength * 0.9 
                    ? 'text-red-500' 
                    : message.length > maxLength * 0.7 
                      ? 'text-yellow-600'
                      : 'text-gray-400'
                )}>
                  {message.length}/{maxLength}
                </span>
              )}
            </div>

            {/* Send/Stop Button */}
            <div className="flex items-center gap-2">
              {isLoading || isStreaming ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStop}
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSendMessage}
                  disabled={!canSend}
                  size="icon"
                  className={cn(
                    'h-8 w-8 transition-all duration-200',
                    canSend 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg hover:scale-105' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {hasUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
      />
    </div>
  )
}