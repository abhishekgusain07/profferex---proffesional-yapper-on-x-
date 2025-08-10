'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ExternalLink, 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Eye,
  Calendar,
  MoreHorizontal,
  Trash2
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

interface TweetCardProps {
  tweet: {
    id: string
    content: string
    mediaIds: string[]
    twitterId: string | null
    createdAt: Date
    account: {
      id: string
      accountId: string
      username: string
      displayName: string
      profileImage: string
      verified: boolean
    }
    analytics?: {
      likes: number
      retweets: number
      replies: number
      views: number
      impressions: number
      engagementRate: number
    }
  }
  showActions?: boolean
  variant?: 'default' | 'compact'
  onDelete?: (tweetId: string) => void
  onViewAnalytics?: (tweet: any) => void
}

export function TweetCard({ 
  tweet, 
  showActions = true, 
  variant = 'default',
  onDelete,
  onViewAnalytics 
}: TweetCardProps) {
  const [imageError, setImageError] = useState(false)
  
  const formatDate = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true })
    } else {
      return format(date, 'MMM d, yyyy')
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const handleImageError = () => {
    setImageError(true)
  }

  return (
    <Card className={`group transition-all duration-200 hover:shadow-md border-0 shadow-sm bg-white/80 backdrop-blur-sm ${
      variant === 'compact' ? 'p-3' : 'p-4'
    }`}>
      <CardContent className="p-0 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className={`${variant === 'compact' ? 'w-10 h-10' : 'w-12 h-12'} ring-2 ring-blue-50 shadow-sm`}>
              <AvatarImage 
                src={imageError ? '' : tweet.account.profileImage} 
                alt={`@${tweet.account.username}`}
                onError={handleImageError}
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 font-semibold">
                {tweet.account.displayName?.charAt(0) || tweet.account.username?.charAt(0) || 'T'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-semibold text-gray-900 truncate ${
                  variant === 'compact' ? 'text-sm' : 'text-base'
                }`}>
                  {tweet.account.displayName}
                </span>
                {tweet.account.verified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <span className={`text-gray-500 truncate ${
                  variant === 'compact' ? 'text-xs' : 'text-sm'
                }`}>
                  @{tweet.account.username}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {formatDate(tweet.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {tweet.twitterId && (
                  <DropdownMenuItem asChild>
                    <a 
                      href={`https://x.com/i/web/status/${tweet.twitterId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on X
                    </a>
                  </DropdownMenuItem>
                )}
                {tweet.analytics && onViewAnalytics && (
                  <DropdownMenuItem onClick={() => onViewAnalytics(tweet)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Analytics
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(tweet.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        <div className={`${variant === 'compact' ? 'text-sm' : 'text-base'} text-gray-900 leading-relaxed`}>
          {tweet.content}
        </div>

        {/* Media */}
        {tweet.mediaIds && tweet.mediaIds.length > 0 && (
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-100 h-48 flex items-center justify-center">
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </div>
                {tweet.mediaIds.length} media file{tweet.mediaIds.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* Analytics */}
        {tweet.analytics && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatNumber(tweet.analytics.likes)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">Likes</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Repeat2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatNumber(tweet.analytics.retweets)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">Retweets</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatNumber(tweet.analytics.replies)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">Replies</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {formatNumber(tweet.analytics.views)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">Views</span>
              </div>
            </div>
            
            {tweet.analytics.engagementRate && (
              <div className="mt-3 text-center">
                <Badge 
                  variant="secondary" 
                  className={`${
                    tweet.analytics.engagementRate >= 5 
                      ? 'bg-green-100 text-green-800' 
                      : tweet.analytics.engagementRate >= 2
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {tweet.analytics.engagementRate.toFixed(1)}% engagement rate
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Published
            </Badge>
            {tweet.twitterId && (
              <span className="text-xs text-gray-400">
                ID: {tweet.twitterId.slice(-8)}
              </span>
            )}
          </div>
          
          {tweet.twitterId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity"
              asChild
            >
              <a href={`https://x.com/i/web/status/${tweet.twitterId}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                View on X
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default TweetCard