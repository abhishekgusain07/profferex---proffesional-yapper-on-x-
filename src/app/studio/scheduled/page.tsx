'use client'

import { trpc } from '@/trpc/client'
import { useSession } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clock, Trash2, Edit, Calendar as CalendarIcon, Image as ImageIcon } from 'lucide-react'
import { format } from 'date-fns'

const ScheduledPage = () => {
  const { data: session, isPending: sessionLoading } = useSession()

  const { data: scheduledTweets, refetch: refetchScheduled, isLoading: scheduledLoading } = trpc.twitter.getScheduled.useQuery(
    undefined,
    { enabled: !!session }
  )

  const cancelScheduled = trpc.twitter.cancelScheduled.useMutation({
    onSuccess: () => {
      refetchScheduled()
    },
  })

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
            <CardDescription>Please log in to view your scheduled tweets</CardDescription>
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
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Scheduled Posts</h1>
              <p className="text-slate-600">Manage your upcoming posts and publishing schedule</p>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Upcoming Posts</CardTitle>
                <CardDescription>Your queue automatically publishes tweets at scheduled times</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                {scheduledLoading ? '...' : (scheduledTweets?.length || 0)} scheduled
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {scheduledLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="p-4 bg-slate-100 rounded-lg">
                      <div className="space-y-3">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="flex items-center justify-between">
                          <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                          <div className="h-6 bg-slate-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : scheduledTweets && scheduledTweets.length > 0 ? (
              <div className="space-y-4">
                {scheduledTweets.map((tweet: any) => (
                  <div key={tweet.id} className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <p className="text-slate-900 leading-relaxed">{tweet.content}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            <span>
                              {tweet.scheduledFor ? format(new Date(tweet.scheduledFor), 'PPP p') : 'Unknown time'}
                            </span>
                          </div>
                          {tweet.mediaIds && tweet.mediaIds.length > 0 && (
                            <div className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              <span>{tweet.mediaIds.length} photo{tweet.mediaIds.length > 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Scheduled
                          </Badge>
                          {(() => {
                            if (!tweet.scheduledFor) return null
                            const scheduledTime = new Date(tweet.scheduledFor)
                            const now = new Date()
                            const diffMinutes = Math.round((scheduledTime.getTime() - now.getTime()) / (1000 * 60))
                            
                            if (diffMinutes < 60) {
                              return (
                                <Badge variant="secondary" className="text-xs">
                                  in {diffMinutes} min
                                </Badge>
                              )
                            } else if (diffMinutes < 1440) {
                              return (
                                <Badge variant="secondary" className="text-xs">
                                  in {Math.round(diffMinutes / 60)}h
                                </Badge>
                              )
                            } else {
                              return (
                                <Badge variant="secondary" className="text-xs">
                                  in {Math.round(diffMinutes / 1440)}d
                                </Badge>
                              )
                            }
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600 hover:text-slate-700"
                          disabled
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelScheduled.mutate({ tweetId: tweet.id })}
                          disabled={cancelScheduled.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {cancelScheduled.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No scheduled posts</h3>
                <p className="text-slate-600 mb-6">Create your first scheduled post using the composer!</p>
                <Button asChild>
                  <a href="/studio">Schedule a post</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ScheduledPage