'use client'

import { useState, memo, PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { ChevronsLeft, Copy, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StreamingMessage } from './streaming-message'
import { AccountAvatar, AccountName, AccountHandle } from '@/hooks/use-account'
import { useTweets } from '@/hooks/use-tweets'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import toast from 'react-hot-toast'

interface TweetMockupProps {
  text?: string
  content?: string
  isLoading?: boolean
  children?: React.ReactNode
}

export const TweetMockup = memo(
  ({ text, content, isLoading = false, children }: TweetMockupProps) => {
    const { shadowEditor } = useTweets()
    const displayText = text || content || ''

    const containerVariants = {
      hidden: { opacity: 0, y: 20, scale: 0.95 },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          type: 'spring' as const,
          duration: 0.6,
          bounce: 0.1,
          staggerChildren: 0.1,
          delayChildren: 0.2,
        },
      },
    }

    const handleApply = () => {
      if (displayText) {
        shadowEditor.update(
          () => {
            const root = $getRoot()
            const paragraph = $createParagraphNode()
            const textNode = $createTextNode(displayText)

            root.clear()
            paragraph.append(textNode)
            root.append(paragraph)
          },
          { tag: 'force-sync' },
        )
        toast.success('Tweet applied')
      }
    }

    const handleCopy = async () => {
      if (displayText) {
        try {
          await navigator.clipboard.writeText(displayText)
          toast.success('Tweet copied to clipboard')
        } catch (error) {
          toast.error('Failed to copy tweet')
        }
      }
    }

    return (
      <motion.div
        variants={isLoading ? containerVariants : undefined}
        initial={isLoading ? 'hidden' : false}
        animate={isLoading ? 'visible' : false}
        className="w-full min-w-0 py-3 px-4 rounded-2xl border border-black border-opacity-[0.01] bg-clip-padding group isolate bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05),0_4px_6px_rgba(34,42,53,0.04),0_24px_68px_rgba(47,48,55,0.05),0_2px_3px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <AccountAvatar className="size-8" />
            <div className="flex flex-col">
              <AccountName animate className="leading-[1.2] text-sm" />
              <AccountHandle className="text-sm leading-[1.2]" />
            </div>
          </div>

          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopy}
                      className="h-8 w-8 hover:bg-gray-100"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy tweet</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                onClick={handleApply}
                variant="secondary"
                size="sm"
                className="text-sm w-fit h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white border-0"
              >
                <ChevronsLeft className="size-4 mr-1" />
                Apply
              </Button>
            </motion.div>
          )}
        </div>

        <div className="w-full flex flex-col items-start">
          <div className="w-full flex-1 py-2.5">
            <div className="mt-1 text-slate-800 text-[15px] space-y-3 whitespace-pre-wrap">
              {isLoading ? (
                <div className="space-y-2">
                  <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="h-4 bg-gray-200 rounded animate-pulse"
                    style={{ width: '85%' }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="h-4 bg-gray-200 rounded animate-pulse"
                    style={{ width: '92%' }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="h-4 bg-gray-200 rounded animate-pulse"
                    style={{ width: '78%' }}
                  />
                </div>
              ) : (
                children || <StreamingMessage content={displayText} />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }
)

TweetMockup.displayName = 'TweetMockup'