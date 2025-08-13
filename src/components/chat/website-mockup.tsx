'use client'

import { PropsWithChildren, memo, useCallback } from 'react'
import { motion, Variants } from 'framer-motion'
import { Globe, ExternalLink, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export const WebsiteMockup = memo(
  ({
    children,
    url,
    title,
    isLoading = false,
  }: PropsWithChildren<{
    isLoading?: boolean
    url?: string
    title?: string
  }>) => {
    const containerVariants = {
      hidden: { opacity: 0, y: 20, scale: 0.95 },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          type: 'spring',
          duration: 0.6,
          bounce: 0.1,
          staggerChildren: 0.1,
          delayChildren: 0.2,
        },
      },
    }

    const getDomain = useCallback((url?: string) => {
      if (!url) return 'fetching...'
      try {
        return new URL(url).hostname
      } catch {
        return 'fetching...'
      }
    }, [])

    const openUrl = useCallback(() => {
      if (url) {
        window.open(url, '_blank')
      }
    }, [url])

    const copyUrl = useCallback(() => {
      if (url) {
        navigator.clipboard.writeText(url)
        toast.success('URL copied to clipboard!')
      }
    }, [url])

    return (
      <motion.div
        variants={isLoading ? (containerVariants as Variants) : undefined}
        initial={isLoading ? 'hidden' : false}
        animate={isLoading ? 'visible' : false}
        className="w-full min-w-80 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden"
      >
        {/* Browser Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
            </div>
          </div>

          {/* URL Bar */}
          <div className="flex-1 mx-4">
            <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200/50">
              <Globe className="size-3.5 text-gray-400" />
              <span className="text-xs text-gray-600 font-mono truncate">
                {getDomain(url)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          {!isLoading && url && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1"
            >
              <Button
                onClick={copyUrl}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
              >
                <Copy className="size-3" />
              </Button>
              <Button
                onClick={openUrl}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <ExternalLink className="size-3 mr-1" />
                Open
              </Button>
            </motion.div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title */}
          {(title || isLoading) && (
            <div className="mb-4">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="h-6 bg-gray-200 rounded animate-pulse"
                  style={{ width: '70%' }}
                />
              ) : (
                <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                  {title}
                </h3>
              )}
            </div>
          )}

          {/* Content */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="h-4 bg-gray-200 rounded animate-pulse"
                  style={{ width: '100%' }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="h-4 bg-gray-200 rounded animate-pulse"
                  style={{ width: '95%' }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="h-4 bg-gray-200 rounded animate-pulse"
                  style={{ width: '85%' }}
                />
              </div>
            ) : (
              <div className="text-gray-700 text-[15px] leading-relaxed space-y-3">
                {children}
              </div>
            )}
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100"
            >
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500 font-medium">
                Reading website content...
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>
    )
  },
)

WebsiteMockup.displayName = 'WebsiteMockup'