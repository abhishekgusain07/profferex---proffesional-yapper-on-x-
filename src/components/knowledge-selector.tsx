'use client'

import { useState, useCallback } from 'react'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Brain, Search, FileText, Globe, Plus, Zap, Filter } from 'lucide-react'
import Link from 'next/link'

// Calculate thread relevance score for better document suggestions
function calculateThreadRelevance(doc: any, threadContext?: any): number {
  if (!threadContext?.isGeneratingThread) return 0
  
  let score = 0
  
  // Type-based scoring (some types work better for threads)
  const typeScores = {
    'txt': 10,
    'pdf': 8,
    'url': 9,
    'docx': 6,
    'image': 4,
    'manual': 3
  }
  score += typeScores[doc.type as keyof typeof typeScores] || 0
  
  // Topic relevance (basic keyword matching)
  if (threadContext.currentTopic && doc.title && doc.description) {
    const topic = threadContext.currentTopic.toLowerCase()
    const content = (doc.title + ' ' + doc.description).toLowerCase()
    if (content.includes(topic)) score += 15
  }
  
  // Preferred types
  if (threadContext.preferredTypes?.includes(doc.type)) {
    score += 5
  }
  
  // Recent usage boost (could be enhanced with actual usage tracking)
  if (doc.lastUsed && Date.now() - new Date(doc.lastUsed).getTime() < 7 * 24 * 60 * 60 * 1000) {
    score += 3
  }
  
  return score
}

export interface SelectedKnowledgeDocument {
  id: string
  title: string
  type: 'url' | 'txt' | 'docx' | 'pdf' | 'image' | 'manual'
  s3Key?: string
  description?: string
}

interface KnowledgeSelectorProps {
  onSelectDocument: (doc: SelectedKnowledgeDocument) => void
  className?: string
  // Thread context for better suggestions
  threadContext?: {
    isGeneratingThread?: boolean
    currentTopic?: string
    preferredTypes?: Array<'url' | 'txt' | 'docx' | 'pdf' | 'image' | 'manual'>
  }
}

export function KnowledgeSelector({ onSelectDocument, className, threadContext }: KnowledgeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'thread-optimal' | 'recent'>('all')

  const { data: knowledgeData, isLoading } = trpc.knowledge.list.useQuery({
    search: searchQuery || undefined,
    limit: 50, // Increased to allow better filtering
    // Add thread context to query if needed
    category: selectedCategory === 'thread-optimal' ? 'thread-optimal' : undefined,
  })

  const rawDocuments = knowledgeData?.documents || []

  // Enhanced document processing with thread relevance
  const documents = rawDocuments
    .map(doc => ({
      ...doc,
      threadRelevance: calculateThreadRelevance(doc, threadContext),
      isThreadOptimal: ['txt', 'pdf', 'url'].includes(doc.type),
    }))
    .filter(doc => {
      if (selectedCategory === 'thread-optimal') {
        return doc.isThreadOptimal
      }
      if (selectedCategory === 'recent') {
        // Show recently used documents (could be tracked in metadata)
        return true // For now, show all
      }
      return true
    })
    .sort((a, b) => {
      if (threadContext?.isGeneratingThread) {
        return b.threadRelevance - a.threadRelevance
      }
      return 0 // Keep original order for non-thread contexts
    })

  const handleSelectDocument = useCallback((doc: any) => {
    onSelectDocument({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      s3Key: doc.s3Key,
      description: doc.description,
    })
    setIsOpen(false)
    setSearchQuery('')
  }, [onSelectDocument])

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="size-4" />
      case 'pdf':
      case 'docx':
      case 'txt':
        return <FileText className="size-4" />
      default:
        return <FileText className="size-4" />
    }
  }

  const getDocumentBadgeVariant = (type: string) => {
    switch (type) {
      case 'url':
        return 'default'
      case 'pdf':
        return 'secondary'
      case 'docx':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={cn('text-stone-600', className)}
          type="button"
        >
          <span className="text-lg">🧠</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-white border-2 shadow-xl" 
        align="start"
        side="top"
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="size-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Knowledge Base</h3>
            {threadContext?.isGeneratingThread && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Zap className="size-3" />
                Thread Mode
              </Badge>
            )}
          </div>
          
          {/* Category filters for thread generation */}
          {threadContext?.isGeneratingThread && (
            <div className="flex gap-1 mb-3">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="text-xs px-2 py-1 h-auto"
              >
                All
              </Button>
              <Button
                variant={selectedCategory === 'thread-optimal' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('thread-optimal')}
                className="text-xs px-2 py-1 h-auto gap-1"
              >
                <Zap className="size-3" />
                Best for Threads
              </Button>
              <Button
                variant={selectedCategory === 'recent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('recent')}
                className="text-xs px-2 py-1 h-auto"
              >
                Recent
              </Button>
            </div>
          )}
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
            <Input
              placeholder={threadContext?.isGeneratingThread ? "Search for thread context..." : "Search knowledge..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-200 focus:border-blue-500"
            />
          </div>
          
          {/* Thread optimization tip */}
          {threadContext?.isGeneratingThread && selectedCategory === 'all' && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-700">
                💡 Text files, PDFs, and URLs work best for generating Twitter threads
              </p>
            </div>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin size-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              Loading knowledge...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="size-12 text-gray-300 mx-auto mb-3" />
              {searchQuery ? (
                <>
                  <p className="text-gray-600 mb-2">No documents found</p>
                  <p className="text-sm text-gray-500">Try adjusting your search terms</p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-2">No knowledge documents yet</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Add documents to reference them in your chats
                  </p>
                  <Link href="/studio/knowledge">
                    <Button size="sm" className="gap-2">
                      <Plus className="size-4" />
                      Add Knowledge
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="p-2">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDocument(doc)}
                  className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 text-gray-500 group-hover:text-gray-700">
                      {getDocumentIcon(doc.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate group-hover:text-blue-900">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          <Badge 
                            variant={getDocumentBadgeVariant(doc.type)}
                            className="text-xs"
                          >
                            {doc.type}
                          </Badge>
                          {/* Thread relevance indicators */}
                          {threadContext?.isGeneratingThread && (
                            <>
                              {doc.isThreadOptimal && (
                                <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700">
                                  <Zap className="size-2" />
                                  Optimal
                                </Badge>
                              )}
                              {doc.threadRelevance > 15 && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                  Relevant
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!isLoading && documents.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <Link href="/studio/knowledge">
              <Button variant="ghost" size="sm" className="w-full justify-center gap-2">
                <Plus className="size-4" />
                Manage Knowledge Base
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}