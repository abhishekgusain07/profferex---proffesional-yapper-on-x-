'use client'

import { trpc } from '@/trpc/client'
import { useSession } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, Calendar, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { format } from 'date-fns'

const PostedPage = () => {
  const { data: session, isPending: sessionLoading } = useSession()

  // This would be a new tRPC endpoint to get posted tweets
  // For now, I'll create a placeholder structure
  const { data: postedTweets, isLoading: postsLoading } = trpc.twitter.getPosted?.useQuery(
    undefined,
    { 
      enabled: !!session,
      // This endpoint doesn't exist yet, so it will show loading state
    }
  ) ?? { data: undefined, isLoading: true }

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Posted Tweets</h1>
              <p className="text-slate-600">View your published posts and their performance</p>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Posts</CardTitle>
                <CardDescription>Your recently published tweets</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {postsLoading ? '...' : (postedTweets?.length || 0)} posts
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-start gap-4 p-4 bg-slate-100 rounded-lg">
                      <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="flex gap-4">
                          <div className="h-3 bg-slate-200 rounded w-16"></div>
                          <div className="h-3 bg-slate-200 rounded w-16"></div>
                          <div className="h-3 bg-slate-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : postedTweets && postedTweets.length > 0 ? (
              <div className="space-y-4">
                {postedTweets.map((tweet: any) => (
                  <div key={tweet.id} className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-slate-900 leading-relaxed">{tweet.content}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{tweet.postedAt ? format(new Date(tweet.postedAt), 'MMM d, yyyy') : 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              <span>{tweet.likes || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              <span>{tweet.replies || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Repeat2 className="w-3 h-3" />
                              <span>{tweet.retweets || 0}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Published
                          </Badge>
                          {tweet.tweetId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              asChild
                            >
                              <a href={`https://x.com/i/web/status/${tweet.tweetId}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View on X
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No posts yet</h3>
                <p className="text-slate-600 mb-6">Your published tweets will appear here after posting</p>
                <Button asChild>
                  <a href="/studio">Create your first post</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PostedPage