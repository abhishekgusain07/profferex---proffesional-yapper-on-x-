'use client'

import { SidebarInset } from '../ui/sidebar'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ArrowLeftFromLine, ArrowRightFromLine, PanelLeft, Calendar, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { useSidebar } from '../ui/sidebar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar20 } from '@/components/tweet-editor/date-picker'
import DuolingoButton from '@/components/ui/duolingo-button'
import { useTweets } from '@/hooks/use-tweets'
import { trpc } from '@/trpc/client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { $getRoot } from 'lexical'
import { usePathname } from 'next/navigation'

export function AppSidebarInset({ children }: { children: React.ReactNode }) {
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const pathname = usePathname()
  const { tweets, resetTweets } = useTweets()
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)

  const postNowMutation = trpc.twitter.postNow.useMutation({
    onSuccess: async () => {
      toast.success('Tweet posted successfully!')
      setIsPostDialogOpen(false)
      await resetTweets() // Clear tweets after successful posting
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to post tweet')
    }
  })

  const scheduleMutation = trpc.twitter.schedule.useMutation({
    onSuccess: async () => {
      toast.success('Tweet scheduled successfully!')
      setIsScheduleDialogOpen(false)
      await resetTweets() // Clear tweets after successful scheduling
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

  return (
    <SidebarInset className="w-full flex-1 overflow-x-hidden bg-stone-100 border border-gray-200">
      {/* Dot Pattern Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px)`,
            backgroundSize: '20px 20px',
            opacity: 0.5,
          }}
        />
      </div>

      <header className="relative z-10 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 justify-between">
        <div className="flex w-full justify-end items-center gap-2 px-4">
          <div className="flex items-center gap-2">
            {/* Schedule/Post buttons - only show on studio page */}
            {pathname === '/studio' && (
              <>
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
              </>
            )}

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleSidebar}
                    className="group/toggle-button"
                  >
                    <PanelLeft className="h-4 w-4 transition-all duration-200 group-hover/toggle-button:opacity-0 group-hover/toggle-button:scale-75" />
                    <div className="absolute transition-all duration-200 opacity-0 scale-75 group-hover/toggle-button:opacity-100 group-hover/toggle-button:scale-100">
                      {isCollapsed ? (
                        <ArrowLeftFromLine className="h-4 w-4" />
                      ) : (
                        <ArrowRightFromLine className="h-4 w-4" />
                      )}
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-stone-800 text-white ">
                  Toggle Sidebar
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>
      {children}
    </SidebarInset>
  )
}