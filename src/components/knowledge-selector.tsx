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
import { Brain, Search, FileText, Globe, Plus } from 'lucide-react'
import Link from 'next/link'

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
}

export function KnowledgeSelector({ onSelectDocument, className }: KnowledgeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: knowledgeData, isLoading } = trpc.knowledge.list.useQuery({
    search: searchQuery || undefined,
    limit: 20,
  })

  const documents = knowledgeData?.documents || []

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
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
            <Input
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-200 focus:border-blue-500"
            />
          </div>
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
                        <Badge 
                          variant={getDocumentBadgeVariant(doc.type)}
                          className="text-xs"
                        >
                          {doc.type}
                        </Badge>
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