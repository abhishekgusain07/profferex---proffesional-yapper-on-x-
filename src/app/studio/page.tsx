'use client'

import TweetEditor from '@/components/tweet-editor/tweet-editor'
import { useSession } from '@/lib/auth-client'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar } from 'lucide-react'
import { useTweets } from '@/hooks/use-tweets'
import { trpc } from '@/trpc/client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { $getRoot } from 'lexical'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar20 } from '@/components/tweet-editor/date-picker'
import DuolingoButton from '@/components/ui/duolingo-button'

const Studio = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const { tweets, clearTweets } = useTweets()
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)

  const postNowMutation = trpc.twitter.postNow.useMutation({
    onSuccess: () => {
      toast.success('Tweet posted successfully!')
      setIsPostDialogOpen(false)
      clearTweets() // Clear tweets after successful posting
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to post tweet')
    }
  })

  const scheduleMutation = trpc.twitter.schedule.useMutation({
    onSuccess: () => {
      toast.success('Tweet scheduled successfully!')
      setIsScheduleDialogOpen(false)
      clearTweets() // Clear tweets after successful scheduling
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to schedule tweet')
    }
  })

  const handlePostNow = () => {
    // Get content from Lexical editors to ensure we have the latest content
    const tweetsWithContent = tweets.map(tweet => ({
      ...tweet,
      content: tweet.editor?.read(() => $getRoot().getTextContent().trim()) || tweet.content.trim()
    }))
    
    const nonEmptyTweets = tweetsWithContent.filter(tweet => tweet.content !== '')
    
    if (nonEmptyTweets.length === 0) {
      toast.error('Tweet cannot be empty')
      return
    }

    if (nonEmptyTweets.length === 1) {
      // Single tweet
      postNowMutation.mutate({
        text: nonEmptyTweets[0].content,
        mediaIds: nonEmptyTweets[0].mediaIds,
        isThread: false
      })
    } else {
      // Thread
      const firstTweet = nonEmptyTweets[0]
      const remainingTweets = nonEmptyTweets.slice(1)
      
      postNowMutation.mutate({
        text: firstTweet.content,
        mediaIds: firstTweet.mediaIds,
        isThread: true,
        threadTweets: remainingTweets.map(tweet => ({
          text: tweet.content,
          mediaIds: tweet.mediaIds
        }))
      })
    }
  }

  const handleSchedule = (date: Date, time: string) => {
    // Get content from Lexical editors to ensure we have the latest content
    const tweetsWithContent = tweets.map(tweet => ({
      ...tweet,
      content: tweet.editor?.read(() => $getRoot().getTextContent().trim()) || tweet.content.trim()
    }))
    
    const nonEmptyTweets = tweetsWithContent.filter(tweet => tweet.content !== '')
    
    if (nonEmptyTweets.length === 0) {
      toast.error('Tweet cannot be empty')
      return
    }

    // Parse time and create scheduled date
    const [hours, minutes] = time.split(':').map(Number)
    const scheduledDateTime = new Date(date)
    scheduledDateTime.setHours(hours || 0, minutes || 0, 0, 0)

    const now = new Date()
    if (scheduledDateTime <= now) {
      toast.error('Scheduled time must be in the future')
      return
    }

    const scheduledUnix = Math.floor(scheduledDateTime.getTime() / 1000)

    // For now, just schedule the first tweet (will add thread support later)
    const firstTweet = nonEmptyTweets[0]
    
    scheduleMutation.mutate({
      text: firstTweet.content,
      scheduledUnix,
      mediaIds: firstTweet.mediaIds
    })
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading session...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access the studio</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full flex-1 bg-stone-100 min-h-screen">
      {/* Header with Post and Schedule buttons */}
      <header className="flex h-16 shrink-0 items-center gap-2 justify-end px-4 bg-white border-b">
        <div className="flex items-center gap-2">
          {/* Schedule Button */}
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <DuolingoButton variant="secondary" size="sm">
                <Calendar className="size-4 mr-2" />
                Schedule
              </DuolingoButton>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-full">
              <DialogHeader>
                <DialogTitle>Schedule Tweet</DialogTitle>
              </DialogHeader>
              <Calendar20
                onSchedule={handleSchedule}
                isPending={scheduleMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          {/* Post Button */}
          <Dialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
            <DialogTrigger asChild>
              <DuolingoButton size="sm">
                Post
              </DuolingoButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Post Tweet</DialogTitle>
              </DialogHeader>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to post this tweet immediately?
                </p>
                <div className="flex gap-2">
                  <DuolingoButton 
                    onClick={handlePostNow}
                    loading={postNowMutation.isPending}
                    size="sm"
                  >
                    Post Now
                  </DuolingoButton>
                  <DuolingoButton 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setIsPostDialogOpen(false)}
                  >
                    Cancel
                  </DuolingoButton>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-xl w-full mx-auto pt-8">
        <TweetEditor />
      </div>
    </div>
  )
}

export default Studio