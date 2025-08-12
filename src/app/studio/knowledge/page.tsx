'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  ChevronDown,
  FilePlus,
  FileText,
  FolderOpen,
  Globe,
  Grid,
  List,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

interface Document {
  id: string
  title: string
  description: string
  updatedAt: Date
  type: 'url' | 'file' | 'manual'
  isStarred: boolean
  metadata?: Record<string, any>
  s3Key?: string
  sourceUrl?: string
  sizeBytes?: number
}

const categoryColors = {
  url: 'bg-blue-100 text-blue-800 border-blue-200',
  file: 'bg-green-100 text-green-800 border-green-200',
  manual: 'bg-purple-100 text-purple-800 border-purple-200',
}

const categoryIcons = {
  url: '🔗',
  file: '📄',
  manual: '📝',
}

interface TweetMetadata {
  isTweet: true
  author: {
    name: string
    username: string
    profileImageUrl: string
  }
  tweet: {
    id: string
    text: string
    createdAt: string
  }
}

const TweetListing = ({ tweetMetadata }: { tweetMetadata: TweetMetadata }) => {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Avatar>
          <AvatarImage src={tweetMetadata.author.profileImageUrl} />
          <AvatarFallback>
            <User className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text-sm font-medium leading-none">{tweetMetadata.author.name}</p>
          <p className="text-xs text-gray-500 leading-none">@{tweetMetadata.author.username}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-500 leading-relaxed">{tweetMetadata.tweet.text}</p>
    </div>
  )
}

const Page = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i]
  }

  const { data: documentsData, isPending } = trpc.knowledge.list.useQuery({
    search: searchQuery || undefined,
  })

  const allDocuments = documentsData?.documents || []

  const documents = useMemo(() => {
    if (!searchQuery.trim()) return allDocuments

    const searchLower = searchQuery.toLowerCase()
    return allDocuments.filter((doc) => {
      const titleMatch = doc.title?.toLowerCase().includes(searchLower)
      const descriptionMatch = doc.description?.toLowerCase().includes(searchLower)
      return titleMatch || descriptionMatch
    })
  }, [allDocuments, searchQuery])

  const deleteDocumentMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => {
      toast.success('Document deleted successfully')
      // Refetch the documents
      void trpc.knowledge.list.invalidate()
    },
    onError: (error) => {
      console.error(error)
      toast.error('Failed to delete document')
    },
  })

  const handleDeleteDocument = (documentId: string) => {
    deleteDocumentMutation.mutate({ id: documentId })
  }

  return (
    <div className="relative z-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-gray-900">Knowledge Base</h1>
                <Badge variant="secondary" className="px-2">
                  {documents.filter((d) => !d.isDeleted).length}
                </Badge>
              </div>
              <p className="text-lg text-gray-600 max-w-prose">
                Teach the AI assistant new knowledge by uploading assets (e.g., product
                details, business bio) and reference specific content so it always writes
                factually.
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-auto">
                  <Plus className="size-5 mr-2" />
                  <span className="whitespace-nowrap">Add Knowledge</span>
                  <ChevronDown className="size-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-3 border-2 shadow-xl">
                <div className="space-y-2">
                  <DropdownMenuItem asChild>
                    <Link
                      href={{
                        pathname: '/studio/knowledge/new',
                        search: '?type=upload',
                      }}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-blue-50 transition-all cursor-pointer border-0 w-full group hover:shadow-sm"
                    >
                      <div className="flex-shrink-0 size-10 bg-gray-100 border border-gray-900 border-opacity-10 bg-clip-padding shadow-sm rounded-md flex items-center justify-center transition-all">
                        <FolderOpen className="size-5 text-gray-600 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-900 transition-colors">
                          Upload Document
                        </h4>
                        <p className="text-sm opacity-60 leading-relaxed">
                          Upload pdf, docx, text or images
                        </p>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link
                      href={{
                        pathname: '/studio/knowledge/new',
                        search: '?type=url',
                      }}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-blue-50 transition-all cursor-pointer border-0 w-full group hover:shadow-sm"
                    >
                      <div className="flex-shrink-0 size-10 bg-gray-100 border border-gray-900 border-opacity-10 bg-clip-padding shadow-sm rounded-md flex items-center justify-center transition-all">
                        <Globe className="size-5 text-gray-600 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-900 transition-colors">
                          Add from Website
                        </h4>
                        <p className="text-sm opacity-60 leading-relaxed">
                          Extract knowledge from articles and blog posts
                        </p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-5" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors bg-white shadow-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex border-2 border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-3 transition-colors',
                    viewMode === 'grid'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  <Grid className="size-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-3 transition-colors',
                    viewMode === 'list'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  <List className="size-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {documents.filter((d) => !d.isDeleted).length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="size-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isPending ? 'Loading documents...' : 'No knowledge yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isPending
                ? ''
                : searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Add knowledge to get started'}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'gap-2',
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'flex flex-col space-y-4',
            )}
          >
            {documents
              .filter((d) => !d.isDeleted)
              .map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    'group relative h-full',
                    viewMode === 'list' ? 'w-full' : '',
                  )}
                >
                  <a
                    href={
                      doc.type === 'url' && doc.sourceUrl
                        ? doc.sourceUrl
                        : doc.s3Key 
                        ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${doc.s3Key}`
                        : '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('block h-full', viewMode === 'list' ? 'w-full' : '')}
                  >
                    <div
                      className={cn(
                        'bg-white rounded-2xl border-2 border-gray-200 hover:border-indigo-300 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 p-6',
                        viewMode === 'list'
                          ? 'flex items-center gap-6'
                          : 'h-full flex flex-col justify-between',
                      )}
                    >
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-2 mb-4',
                          viewMode === 'list' ? 'mb-0 flex-shrink-0' : '',
                        )}
                      >
                        <Badge className="px-2" variant="secondary">
                          {doc.type === 'url'
                            ? doc.metadata && 'isTweet' in doc.metadata && doc.metadata.isTweet
                              ? 'tweet'
                              : 'website'
                            : doc.type}
                        </Badge>
                        {doc.isStarred && <div className="text-yellow-500 ">⭐</div>}
                      </div>

                      <div className={cn(viewMode === 'list' ? 'flex-1 min-w-0' : '')}>
                        {doc.metadata && 'isTweet' in doc.metadata && doc.metadata.isTweet ? (
                          <TweetListing tweetMetadata={doc.metadata as TweetMetadata} />
                        ) : (
                          <>
                            <h3
                              className={cn(
                                'font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors',
                                viewMode === 'list'
                                  ? 'text-lg mb-1 line-clamp-1'
                                  : 'text-xl mb-3 line-clamp-2',
                              )}
                            >
                              {doc.title}
                            </h3>

                            <p className="text-sm text-gray-500 line-clamp-4 leading-relaxed">
                              {doc.description}
                            </p>
                          </>
                        )}
                      </div>

                      <div
                        className={cn(
                          'flex items-center gap-5 text-sm text-gray-500',
                          viewMode === 'list'
                            ? 'flex-shrink-0 flex-col items-end gap-1'
                            : 'mt-auto pt-4',
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span>{format(doc.updatedAt, 'MMM dd')}</span>
                          {doc.type !== 'url' && doc.sizeBytes && (
                            <span>・ {formatBytes(doc.sizeBytes)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-4 right-4 size-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDeleteDocument(doc.id)
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Page