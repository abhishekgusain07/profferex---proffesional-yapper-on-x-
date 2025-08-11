'use client'

import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

interface LoadingMessageProps {
  hasAttachments?: boolean
}

export function LoadingMessage({ hasAttachments = false }: LoadingMessageProps) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <motion.div 
          className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Bot className="w-4 h-4 text-white" />
        </motion.div>
      </div>

      {/* Message content */}
      <div className="flex-1 max-w-[80%]">
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          {/* Attachment processing indicator */}
          {hasAttachments && (
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
              <div className="flex gap-1">
                <motion.div
                  className="w-2 h-2 bg-blue-500 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-blue-500 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-blue-500 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                />
              </div>
              <span>Processing attachments...</span>
            </div>
          )}

          {/* Typing indicator */}
          <div className="flex items-center gap-2 text-gray-600">
            <div className="flex gap-1">
              <motion.div
                className="w-2 h-2 bg-gray-400 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 bg-gray-400 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 bg-gray-400 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
              />
            </div>
            <span className="text-sm">AI is thinking...</span>
          </div>
        </div>
      </div>
    </div>
  )
}