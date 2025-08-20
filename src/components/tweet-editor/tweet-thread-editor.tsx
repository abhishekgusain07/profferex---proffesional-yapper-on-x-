'use client'

import React from 'react'
import { useTweets } from '@/hooks/use-tweets'
import { Button } from '@/components/ui/button'
import { Plus, X, MessageSquareMore } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { initialConfig, Tweet } from '@/hooks/use-tweets'
import { cn } from '@/lib/utils'

// Individual Tweet Editor Component
interface SingleTweetEditorProps {
  tweet: Tweet
  index: number
  totalTweets: number
  onUpdate: (id: string, content: string) => void
  onRemove: (id: string) => void
}

function SingleTweetEditor({ tweet, index, totalTweets, onUpdate, onRemove }: SingleTweetEditorProps) {
  const [charCount, setCharCount] = React.useState(tweet.content.length)
  
  const TweetEditorContent = () => {
    const [editor] = useLexicalComposerContext()
    
    React.useEffect(() => {
      // Initialize editor with tweet content
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        if (tweet.content) {
          const paragraph = $createParagraphNode()
          const textNode = $createTextNode(tweet.content)
          paragraph.append(textNode)
          root.append(paragraph)
        }
      })
      
      // Listen for content changes
      const removeListener = editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const root = $getRoot()
          const textContent = root.getTextContent()
          setCharCount(textContent.length)
          onUpdate(tweet.id, textContent)
        })
      })
      
      return removeListener
    }, [editor, tweet.id])
    
    return null
  }

  const isOverLimit = charCount > 280
  const isConnectedAfter = index < totalTweets - 1

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative"
    >
      {/* Thread connection line */}
      {isConnectedAfter && (
        <div className="absolute left-6 top-full w-0.5 h-4 bg-gray-300 z-10" />
      )}
      
      <div className={cn(
        "relative rounded-xl border-2 bg-white shadow-sm transition-all",
        isOverLimit ? "border-red-300" : "border-gray-200",
        "focus-within:border-blue-500 focus-within:shadow-md"
      )}>
        {/* Tweet number indicator */}
        <div className="absolute -left-3 top-4 w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
          {index + 1}
        </div>
        
        {/* Remove button for threads with multiple tweets */}
        {totalTweets > 1 && (
          <button
            onClick={() => onRemove(tweet.id)}
            className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        
        <LexicalComposer initialConfig={{
          ...initialConfig,
          namespace: `tweet-thread-${tweet.id}`,
          editable: true,
        }}>
          <TweetEditorContent />
          <div className="p-4">
            <PlainTextPlugin
              contentEditable={
                <ContentEditable
                  className={cn(
                    "w-full outline-none text-base min-h-[100px] resize-none",
                    "placeholder:text-gray-400"
                  )}
                  placeholder={`What's happening? (Tweet ${index + 1})` as any}
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            
            {/* Character count */}
            <div className="flex justify-between items-center mt-3 text-sm">
              <div className="text-gray-500">
                Tweet {index + 1} of {totalTweets}
              </div>
              <div className={cn(
                "font-medium",
                isOverLimit ? "text-red-500" : 
                charCount > 260 ? "text-orange-500" : "text-gray-500"
              )}>
                {charCount}/280
              </div>
            </div>
          </div>
        </LexicalComposer>
      </div>
    </motion.div>
  )
}

// Main Thread Editor Component
export default function TweetThreadEditor() {
  const { tweets, addTweet, updateTweet, removeTweet, clearTweets } = useTweets()
  
  const handleAddTweet = () => {
    addTweet({ initialContent: '' })
  }
  
  const handleUpdateTweet = (id: string, content: string) => {
    updateTweet(id, content)
  }
  
  const handleRemoveTweet = (id: string) => {
    removeTweet(id)
  }
  
  const isThread = tweets.length > 1
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareMore className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">
            {isThread ? `Thread (${tweets.length} tweets)` : 'Tweet'}
          </h3>
        </div>
        
        {tweets.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearTweets}
            className="text-red-600 hover:text-red-700"
          >
            Clear All
          </Button>
        )}
      </div>
      
      {/* Tweet Editors */}
      <AnimatePresence>
        {tweets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-gray-500"
          >
            <MessageSquareMore className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="mb-4">No tweets yet. Start by creating your first tweet!</p>
            <Button onClick={handleAddTweet}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Tweet
            </Button>
          </motion.div>
        ) : (
          tweets.map((tweet, index) => (
            <SingleTweetEditor
              key={tweet.id}
              tweet={tweet}
              index={index}
              totalTweets={tweets.length}
              onUpdate={handleUpdateTweet}
              onRemove={handleRemoveTweet}
            />
          ))
        )}
      </AnimatePresence>
      
      {/* Add Tweet Button */}
      {tweets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            variant="outline"
            onClick={handleAddTweet}
            className="w-full border-dashed border-2 hover:border-blue-300 hover:bg-blue-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Tweet
          </Button>
        </motion.div>
      )}
      
      {/* Thread Info */}
      {isThread && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-700">
            <MessageSquareMore className="w-4 h-4" />
            <span className="text-sm font-medium">
              Thread with {tweets.length} tweets
            </span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Tweets will be posted in sequence and threaded together
          </p>
        </div>
      )}
    </div>
  )
}