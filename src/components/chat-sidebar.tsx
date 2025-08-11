'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageSquare, 
  X, 
  Plus, 
  History, 
  Sparkles,
  Settings,
  ChevronRight
} from 'lucide-react'
import { useChatContext, useChatConversations } from '@/hooks/use-chat'
import { Messages } from '@/components/chat/messages'
import { ChatInput } from '@/components/chat/chat-input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const [showHistory, setShowHistory] = useState(false)
  const { 
    conversationId, 
    messages, 
    startNewConversation, 
    loadConversation, 
    clearChat 
  } = useChatContext()
  
  const { 
    conversations, 
    isLoading: conversationsLoading, 
    deleteConversation 
  } = useChatConversations()

  const handleNewChat = useCallback(async () => {
    await startNewConversation()
    setShowHistory(false)
  }, [startNewConversation])

  const handleLoadConversation = useCallback(async (id: string) => {
    await loadConversation(id)
    setShowHistory(false)
  }, [loadConversation])

  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(id)
  }, [deleteConversation])

  // Prompt suggestions for new users
  const promptSuggestions = [
    {
      title: "Create a viral tweet",
      prompt: "Help me create a viral tweet about productivity tips for remote workers"
    },
    {
      title: "Thread about AI",
      prompt: "Write a Twitter thread explaining AI in simple terms for beginners"
    },
    {
      title: "Industry insights",
      prompt: "Suggest tweets about the latest trends in web development"
    },
    {
      title: "Personal story",
      prompt: "Help me craft a tweet about overcoming imposter syndrome in tech"
    }
  ]

  const handleSuggestionClick = useCallback(async (prompt: string) => {
    // If no conversation exists, create one first
    if (!conversationId) {
      await startNewConversation()
    }
    
    // Send the prompt message
    // This will be handled by the ChatInput component
    // For now, we'll just create a new conversation
  }, [conversationId, startNewConversation])

  return (
    <>
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">AI Assistant</h2>
                  <p className="text-xs text-gray-500">Tweet creation & ideas</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNewChat}
                        className="h-8 w-8"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>New conversation</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowHistory(true)}
                        className="h-8 w-8"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Chat history</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Close chat</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col min-h-0">
              {messages.length === 0 ? (
                // Welcome screen with suggestions
                <div className="flex-1 p-6 flex flex-col justify-center">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Welcome to AI Chat
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      I'm here to help you create engaging tweets, brainstorm content ideas, and improve your social media presence.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Try asking me about:
                    </h4>
                    {promptSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.prompt)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border border-gray-200',
                          'hover:border-blue-300 hover:bg-blue-50 transition-all duration-200',
                          'group cursor-pointer'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900 text-sm mb-1">
                              {suggestion.title}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {suggestion.prompt}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Messages className="flex-1" />
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <ChatInput 
                placeholder="Ask about creating tweets, content ideas..."
                className="bg-white"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Chat History
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Start chatting to see your history here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      'group flex items-center justify-between p-3 rounded-lg',
                      'hover:bg-gray-50 cursor-pointer border border-transparent',
                      'hover:border-gray-200 transition-all duration-200',
                      conversationId === conversation.id && 'bg-blue-50 border-blue-200'
                    )}
                    onClick={() => handleLoadConversation(conversation.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {conversation.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(conversation.lastUpdated), { addSuffix: true })}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {conversation.messageCount} messages
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  )
}