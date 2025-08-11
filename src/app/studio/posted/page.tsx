'use client'

import { trpc } from '@/trpc/client'
import { useSession } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, Plus, BarChart3, Search } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import TweetCard from '@/components/tweet-card'
import SearchBar from '@/components/search-bar'
import TweetAnalytics from '@/components/tweet-analytics'
import OptimizedTweetList from '@/components/optimized-tweet-list'
import AnalyticsDashboard from '@/components/analytics-dashboard'
import TweetCardSkeleton from '@/components/tweet-card-skeleton'
import { usePerformanceMonitor } from '@/hooks/use-performance'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'

interface SearchFilters {
  accountId?: string
  dateFrom?: Date
  dateTo?: Date
  sortBy?: 'newest' | 'oldest' | 'most_engaged'
}

const PostedPage = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({})
  const [selectedTweetForAnalytics, setSelectedTweetForAnalytics] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'tweets' | 'analytics'>('tweets')

  // Performance monitoring
  const performance = usePerformanceMonitor('PostedPage', [searchQuery, searchFilters])

  // Get user's Twitter accounts for filter dropdown
  const { data: twitterAccounts } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { enabled: !!session }
  )

  // Get posted tweets with filters
  const queryInput = useMemo(() => ({
    limit: 20,
    search: searchQuery || undefined,
    ...searchFilters
  }), [searchQuery, searchFilters])

  const { 
    data: postedData, 
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.twitter.getPosted.useInfiniteQuery(
    queryInput,
    { 
      enabled: !!session,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )

  // Flatten tweets from all pages
  const allTweets = postedData?.pages.flatMap(page => page.tweets) || []
  const totalCount = allTweets.length

  // Handle search
  const handleSearch = useCallback((query: string, filters?: SearchFilters) => {
    setSearchQuery(query)
    if (filters) {
      setSearchFilters(filters)
    }
  }, [])

  // Handle analytics view
  const handleViewAnalytics = useCallback((tweet: any) => {
    setSelectedTweetForAnalytics(tweet)
  }, [])

  // Loading skeleton component
  const TweetCardSkeleton = () => (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="h-16 bg-gray-200 rounded" />
            <div className="flex gap-4">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100/80 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100/80 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to view your posted tweets</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100/80">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center shadow-sm">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Posted Tweets</h1>
                <p className="text-gray-600">View your published posts and their performance</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setViewMode('tweets')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'tweets'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tweets
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === 'analytics'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Analytics
                </button>
              </div>

              <Badge variant="secondary" className="bg-green-100 text-green-700 px-3 py-1">
                {postsLoading ? '...' : `${totalCount} posts`}
              </Badge>
              <Button asChild size="sm" className="gap-2">
                <a href="/studio">
                  <Plus className="w-4 h-4" />
                  New Tweet
                </a>
              </Button>
            </div>
          </div>

          {/* Search Bar - Only show for tweets view */}
          {viewMode === 'tweets' && (
            <SearchBar
              onSearch={handleSearch}
              accounts={twitterAccounts?.map(account => ({
                id: account.id,
                username: account.username,
                displayName: account.displayName
              })) || []}
              className="mb-6"
            />
          )}
        </div>

        {/* Content */}
        {viewMode === 'analytics' ? (
          /* Analytics View */
          <AnalyticsDashboard
            tweets={allTweets.map(tweet => ({
              ...tweet,
              createdAt: new Date(tweet.createdAt),
              analytics: tweet.analytics || {
                likes: 0,
                retweets: 0,
                replies: 0,
                quotes: 0,
                views: 0,
                impressions: 0,
                engagementRate: 0
              }
            }))}
          />
        ) : postsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <TweetCardSkeleton key={i} />
            ))}
          </div>
        ) : allTweets.length > 0 ? (
          <>
            {/* Results Info */}
            {(searchQuery || Object.keys(searchFilters).length > 0) && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800">
                  <Search className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Found {totalCount} tweet{totalCount !== 1 ? 's' : ''}
                    {searchQuery && ` containing "${searchQuery}"`}
                  </span>
                </div>
              </div>
            )}

            {/* Optimized Tweet List */}
            <OptimizedTweetList
              tweets={allTweets.map((tweet) => ({
                id: tweet.id,
                content: tweet.content,
                mediaIds: tweet.mediaIds || [],
                twitterId: tweet.twitterId,
                createdAt: new Date(tweet.createdAt),
                account: {
                  id: tweet.account.id,
                  accountId: tweet.account.accountId,
                  username: tweet.account.username,
                  displayName: tweet.account.displayName,
                  profileImage: tweet.account.profileImage,
                  verified: tweet.account.verified
                },
                analytics: tweet.analytics || {
                  likes: 0,
                  retweets: 0,
                  replies: 0,
                  quotes: 0,
                  views: 0,
                  impressions: 0,
                  engagementRate: 0
                }
              }))}
              isLoading={postsLoading}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              onViewAnalytics={handleViewAnalytics}
            />
          </>
        ) : (
          /* Empty State */
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ExternalLink className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery || Object.keys(searchFilters).length > 0 
                  ? 'No tweets found' 
                  : 'No posts yet'
                }
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchQuery || Object.keys(searchFilters).length > 0
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Your published tweets will appear here after posting. Start creating amazing content!'
                }
              </p>
              <Button asChild className="gap-2">
                <a href="/studio">
                  <Plus className="w-4 h-4" />
                  {searchQuery || Object.keys(searchFilters).length > 0 
                    ? 'Create New Tweet' 
                    : 'Create your first post'
                  }
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Analytics Dialog */}
        <Dialog 
          open={!!selectedTweetForAnalytics} 
          onOpenChange={(open) => !open && setSelectedTweetForAnalytics(null)}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tweet Analytics</DialogTitle>
            </DialogHeader>
            {selectedTweetForAnalytics && (
              <div className="space-y-6">
                {/* Tweet Preview */}
                <TweetCard
                  tweet={selectedTweetForAnalytics}
                  variant="compact"
                  showActions={false}
                />
                
                {/* Detailed Analytics */}
                <TweetAnalytics
                  tweetId={selectedTweetForAnalytics.id}
                  analytics={selectedTweetForAnalytics.analytics}
                  variant="detailed"
                  showComparison={true}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default PostedPage