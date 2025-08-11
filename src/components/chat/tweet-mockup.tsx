'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Copy, Heart, MessageCircle, Repeat2, Share, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StreamingMessage } from './streaming-message'
import toast from 'react-hot-toast'

interface TweetMockupProps {
  content: string
  isLoading?: boolean
  onInsertToComposer?: () => void
}

export function TweetMockup({ content, isLoading = false, onInsertToComposer }: TweetMockupProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Extract tweet content from AI response
  const extractTweetContent = (text: string): string => {
    // Look for patterns like "Tweet:", "Here's a tweet:", etc.
    const tweetPatterns = [
      /(?:tweet|post):\s*["']?([^"'\n]+)["']?/i,
      /["']([^"'\n]{1,280})["']/,
      /^([^.\n]{1,280})$/m
    ]

    for (const pattern of tweetPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // If no pattern matches, return the first 280 characters
    return text.slice(0, 280).trim()
  }

  const tweetText = extractTweetContent(content)
  const characterCount = tweetText.length
  const isOverLimit = characterCount > 280

  const handleCopyTweet = async () => {
    try {
      await navigator.clipboard.writeText(tweetText)
      toast.success('Tweet copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy tweet')
    }
  }

  const handleInsertToComposer = () => {
    if (onInsertToComposer) {
      onInsertToComposer()
      toast.success('Tweet inserted into composer')
    }
  }

  return (
    <div className="space-y-3">
      {/* AI Response (if more than just the tweet) */}
      {content !== tweetText && (
        <div className="text-sm text-gray-600">
          <StreamingMessage content={content} />
        </div>
      )}

      {/* Tweet Mockup */}
      <motion.div
        className="relative border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        {/* Tweet Header */}
        <div className="flex items-center gap-3 p-4 pb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">Y</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-900">Your Name</span>
              <span className="text-blue-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-gray-500">@yourhandle</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">now</span>
            </div>
          </div>
          <button className="p-1 hover:bg-gray-100 rounded-full">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tweet Content */}
        <div className="px-4 pb-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
              />
              <span className="text-sm">Generating tweet...</span>
            </div>
          ) : (
            <div className="text-gray-900 leading-relaxed">
              <StreamingMessage content={tweetText} isStreaming={false} />
            </div>
          )}
        </div>

        {/* Character Count */}
        {!isLoading && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                <span className={isOverLimit ? 'text-red-500' : 'text-gray-500'}>
                  {characterCount}/280
                </span>
              </div>
              {isOverLimit && (
                <span className="text-xs text-red-500">Tweet is too long</span>
              )}
            </div>
          </div>
        )}

        {/* Tweet Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-8">
            <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">0</span>
            </button>
            <button className="flex items-center gap-1 text-gray-500 hover:text-green-500 transition-colors">
              <Repeat2 className="w-4 h-4" />
              <span className="text-sm">0</span>
            </button>
            <button className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors">
              <Heart className="w-4 h-4" />
              <span className="text-sm">0</span>
            </button>
            <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors">
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hover Actions */}
        {isHovered && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-2 right-2 flex items-center gap-1"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyTweet}
                    className="h-8 px-2 bg-white/90 backdrop-blur-sm shadow-md"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy tweet</p>
                </TooltipContent>
              </Tooltip>

              {onInsertToComposer && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleInsertToComposer}
                      className="h-8 px-2 bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                    >
                      <ArrowRight className="w-3 h-3 mr-1" />
                      Insert
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Insert into composer</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}