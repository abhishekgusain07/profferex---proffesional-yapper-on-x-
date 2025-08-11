'use client'

import { useState, useMemo, memo, useCallback, useEffect } from 'react'
import TweetCard from './tweet-card'
import TweetCardSkeleton from './tweet-card-skeleton'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'

interface Tweet {
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

interface OptimizedTweetListProps {
  tweets: Tweet[]
  isLoading?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  onViewAnalytics?: (tweet: Tweet) => void
  onDeleteTweet?: (tweetId: string) => void
  className?: string
}

// Memoized tweet card to prevent unnecessary re-renders
const MemoizedTweetCard = memo(TweetCard, (prevProps, nextProps) => {
  // Custom comparison to avoid re-renders unless essential props change
  return (
    prevProps.tweet.id === nextProps.tweet.id &&
    prevProps.tweet.content === nextProps.tweet.content &&
    prevProps.tweet.twitterId === nextProps.tweet.twitterId &&
    JSON.stringify(prevProps.tweet.analytics) === JSON.stringify(nextProps.tweet.analytics)
  )
})

MemoizedTweetCard.displayName = 'MemoizedTweetCard'

// Virtual tweet card that only renders when in viewport
const VirtualTweetCard = memo(({ tweet, onViewAnalytics, onDeleteTweet, index }: {
  tweet: Tweet
  onViewAnalytics?: (tweet: Tweet) => void
  onDeleteTweet?: (tweetId: string) => void
  index: number
}) => {
  const { ref, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '200px',
  })

  const handleViewAnalytics = useCallback(() => {
    if (onViewAnalytics) {
      onViewAnalytics(tweet)
    }
  }, [tweet, onViewAnalytics])

  const handleDelete = useCallback((tweetId: string) => {
    if (onDeleteTweet) {
      onDeleteTweet(tweetId)
    }
  }, [onDeleteTweet])

  return (
    <div ref={ref} className="min-h-[200px]">
      {hasIntersected ? (
        <MemoizedTweetCard
          tweet={tweet}
          onViewAnalytics={handleViewAnalytics}
          onDelete={handleDelete}
        />
      ) : (
        <TweetCardSkeleton showAnalytics={!!tweet.analytics} />
      )}
    </div>
  )
})

VirtualTweetCard.displayName = 'VirtualTweetCard'

export function OptimizedTweetList({
  tweets,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onViewAnalytics,
  onDeleteTweet,
  className = ''
}: OptimizedTweetListProps) {
  const [visibleCount, setVisibleCount] = useState(10) // Start with 10 tweets
  
  // Load more trigger for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
    enabled: hasNextPage && !isFetchingNextPage
  })

  // Auto-load more when intersection observer triggers
  useEffect(() => {
    if (isIntersecting && hasNextPage && onLoadMore && !isFetchingNextPage) {
      onLoadMore()
    }
  }, [isIntersecting, hasNextPage, onLoadMore, isFetchingNextPage])

  // Gradually show more tweets for better performance
  const visibleTweets = useMemo(() => {
    return tweets.slice(0, visibleCount)
  }, [tweets, visibleCount])

  const showMoreTweets = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 10, tweets.length))
  }, [tweets.length])

  if (isLoading && tweets.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <TweetCardSkeleton key={i} showAnalytics />
        ))}
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Render visible tweets with virtualization */}
      {visibleTweets.map((tweet, index) => (
        <VirtualTweetCard
          key={tweet.id}
          tweet={tweet}
          onViewAnalytics={onViewAnalytics}
          onDeleteTweet={onDeleteTweet}
          index={index}
        />
      ))}

      {/* Show more tweets button (client-side pagination) */}
      {visibleCount < tweets.length && (
        <div className="flex justify-center py-4">
          <Button
            onClick={showMoreTweets}
            variant="outline"
            className="gap-2"
          >
            Show More Tweets ({tweets.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-600">Loading more tweets...</span>
            </div>
          ) : (
            <Button
              onClick={onLoadMore}
              variant="ghost"
              className="gap-2"
            >
              Load More Tweets
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default OptimizedTweetList