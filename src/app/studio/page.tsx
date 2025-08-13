'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { useSession, signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import DuolingoButton from '@/components/ui/duolingo-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, X, Upload, Calendar as CalendarIcon, Clock, Trash2, ChevronDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import TweetEditor from '@/components/tweet-editor/tweet-editor'
import { useTweets } from '@/hooks/use-tweets'
import Confetti, { type ConfettiRef } from '@/components/confetti'

const MAX_TWEET_LEN = 280

const tweetSchema = z.object({
  text: z.string().min(1, 'Tweet cannot be empty').max(MAX_TWEET_LEN, 'Tweet exceeds 280 characters'),
})

type TweetFormValues = z.infer<typeof tweetSchema>

type LocalMedia = {
  id: string
  file: File
  previewUrl: string
  mediaType: 'image' | 'gif' | 'video'
  uploading: boolean
  progress: number
  error?: string
  r2Key?: string
  media_id?: string
}

const Studio = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const { currentTweet, charCount, setTweetContent, setCharCount } = useTweets()
  const [lastTweetId, setLastTweetId] = useState<string | null>(null)
  const [media, setMedia] = useState<LocalMedia[]>([])
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined)
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const confettiRef = useRef<ConfettiRef>(null)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const form = useForm<TweetFormValues>({
    resolver: zodResolver(tweetSchema),
    defaultValues: { text: '' },
    mode: 'onChange',
  })

  // Twitter OAuth link
  const createTwitterLink = trpc.twitter.createLink.useQuery(
    { action: 'add-account' },
    { enabled: false }
  )

  const { data: twitterAccounts, isLoading: accountsLoading, refetch: refetchAccounts } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { enabled: !!session }
  )

  const { data: activeAccount, isLoading: activeAccountLoading, refetch: refetchActiveAccount } = trpc.twitter.getActiveAccount.useQuery(
    undefined,
    { 
      enabled: !!session,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0, // Always refetch to ensure latest active account
    }
  )

  // tRPC mutations

  const uploadMediaFromR2 = trpc.twitter.uploadMediaFromR2.useMutation({
    onError: (err, vars) => {
      setMedia((prev) => prev.map((m) => (m.id === vars.r2Key ? { ...m, uploading: false, error: err.message } : m)))
    },
  })

  const postNow = trpc.twitter.postNow.useMutation({
    onSuccess: (res) => {
      setLastTweetId(res.tweetId)
      form.reset({ text: '' })
      setMedia([])
      refetchAccounts()
      
      // Fire confetti animation
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        })
      }, 200)
    },
  })

  const scheduleTweet = trpc.twitter.schedule.useMutation({
    onSuccess: () => {
      form.reset({ text: '' })
      setMedia([])
      setScheduledDate(undefined)
      setScheduledTime('09:00')
      refetchScheduled()
    },
  })

  const { data: scheduledTweets, refetch: refetchScheduled } = trpc.twitter.getScheduled.useQuery(
    undefined,
    { enabled: !!session }
  )

  const cancelScheduled = trpc.twitter.cancelScheduled.useMutation({
    onSuccess: () => {
      refetchScheduled()
    },
  })

  const remaining = useMemo(() => MAX_TWEET_LEN - charCount, [charCount])
  const overLimit = remaining < 0


  // Combine date and time into Unix timestamp
  const getScheduledUnix = () => {
    if (!scheduledDate || !scheduledTime) return null
    const [hours, minutes] = scheduledTime.split(':').map(Number)
    const combined = new Date(scheduledDate)
    combined.setHours(hours, minutes, 0, 0)
    return Math.floor(combined.getTime() / 1000)
  }

  // Handle form submission (post immediately)
  const handleSubmit = () => {
    postNow.mutate({ text: currentTweet.content.trim(), mediaIds })
  }

  // Handle scheduling tweets
  const handleSchedule = () => {
    const scheduledUnix = getScheduledUnix()
    if (!scheduledUnix) {
      alert('Please select a valid date and time')
      return
    }
    
    // Validate that scheduled time is at least 1 minute in the future
    const now = Date.now()
    if (scheduledUnix * 1000 <= now + 60000) {
      alert('Schedule time must be at least 1 minute in the future')
      return
    }
    
    scheduleTweet.mutate({
      text: currentTweet.content.trim(),
      scheduledUnix,
      mediaIds,
    })
  }


  function detectMediaType(file: File): LocalMedia['mediaType'] | null {
    console.log(`🔍 [DETECT] Analyzing file: "${file.name}", type: "${file.type}", size: ${file.size}`)
    const isPng = file.type === 'image/png'
    const isJpeg = file.type === 'image/jpeg'
    if (isPng || isJpeg) {
      console.log(`🖼️ [DETECT] Allowed image detected (${isPng ? 'PNG' : 'JPEG'})`)
      return 'image'
    }
    console.log(`❌ [DETECT] Unsupported file type (only PNG or JPEG allowed)`)
    return null
  }

  function violatesTwitterRules(next: LocalMedia['mediaType']): string | null {
    const hasVideoOrGif = media.some((m) => m.mediaType === 'video' || m.mediaType === 'gif')
    const imageCount = media.filter((m) => m.mediaType === 'image').length
    if (next === 'video' || next === 'gif') {
      if (media.length > 0) return 'You can only attach one video or GIF by itself.'
    } else if (next === 'image') {
      if (hasVideoOrGif) return 'Images cannot be mixed with video or GIF.'
      if (imageCount >= 4) return 'You can attach up to 4 images.'
    }
    return null
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !twitterAccounts?.length) return

    for (const file of Array.from(files)) {
      console.log(`🔍 [FRONTEND] ========== FILE DETECTION DEBUG ==========`)
      console.log(`🔍 [FRONTEND] File name: "${file.name}"`)
      console.log(`🔍 [FRONTEND] File type (MIME): "${file.type}"`)
      console.log(`🔍 [FRONTEND] File size: ${file.size} bytes`)
      
      const type = detectMediaType(file)
      console.log(`🎯 [FRONTEND] Detected media type: "${type}"`)
      
      if (!type) {
        console.log(`❌ [FRONTEND] Unsupported file type, skipping`)
        // unsupported type
        continue
      }
      const ruleError = violatesTwitterRules(type)
      if (ruleError) {
        // Could show a toast; for now skip
        continue
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const previewUrl = URL.createObjectURL(file)
      const local: LocalMedia = {
        id,
        file,
        previewUrl,
        mediaType: type,
        uploading: true,
        progress: 0,
      }
      setMedia((prev) => [...prev, local])

      try {
        console.log(`🚀 [UPLOAD-${id}] Starting upload for file:`, { 
          fileName: file.name, 
          fileType: file.type, 
          fileSize: file.size,
          mediaType: type 
        })

        // Option 1: Direct upload via API route (simpler, server proxy)
        const formData = new FormData()
        formData.append('file', file)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`)
        }

        const { key } = await uploadResponse.json()
        console.log(`✅ [UPLOAD-${id}] Upload successful, key: ${key}`)

        setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, progress: 100 } : m)))

        console.log(`🔄 [UPLOAD-${id}] R2 upload complete, exchanging for Twitter media_id...`)
        // We only allow images (JPEG/PNG)
        const finalMediaType: LocalMedia['mediaType'] = 'image'
        console.log(`📤 [UPLOAD-${id}] Calling uploadMediaFromR2 with:`, { r2Key: key, mediaType: finalMediaType })
        
        // Exchange for Twitter media_id
        const { media_id } = await uploadMediaFromR2.mutateAsync({ r2Key: key, mediaType: finalMediaType })
        console.log(`✅ [UPLOAD-${id}] Got Twitter media_id:`, media_id)

        setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, progress: 100, r2Key: key, media_id } : m)))
        console.log(`🎉 [UPLOAD-${id}] Upload process complete!`)
      } catch (err: any) {
        console.error(`❌ [UPLOAD-${id}] Upload failed:`, err)
        console.error(`❌ [UPLOAD-${id}] Error stack:`, err.stack)
        setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, error: err.message || 'Upload failed' } : m)))
      } finally {
        console.log(`🧹 [UPLOAD-${id}] Cleaning up...`)
        abortControllersRef.current.delete(id)
      }
    }
  }

  function removeMedia(id: string) {
    const controller = abortControllersRef.current.get(id)
    if (controller) controller.abort()
    setMedia((prev) => prev.filter((m) => m.id !== id))
  }

  const hasUploading = media.some((m) => m.uploading)
  const mediaIds = media.filter((m) => m.media_id).map((m) => m.media_id!)

  // Refresh active account when component mounts or becomes visible
  useEffect(() => {
    // Refetch active account when the component mounts
    if (session) {
      refetchActiveAccount()
    }
  }, [session, refetchActiveAccount])

  // Listen for visibility changes and focus events to refetch when user returns to the tab/window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session) {
        refetchActiveAccount()
      }
    }

    const handleWindowFocus = () => {
      if (session) {
        refetchActiveAccount()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [session, refetchActiveAccount])

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
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100/80 py-8 px-4">
      <div className="max-w-xl w-full mx-auto">
      {/* ContentPort-style Tweet Editor Card */}
      <div className="relative bg-white p-6 rounded-2xl w-full border border-stone-200 bg-clip-padding group isolate shadow-[0_1px_1px_rgba(0,0,0,0.05),0_4px_6px_rgba(34,42,53,0.04),0_24px_68px_rgba(47,48,55,0.05),0_2px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_2px_2px_rgba(0,0,0,0.06),0_6px_10px_rgba(34,42,53,0.05),0_28px_72px_rgba(47,48,55,0.06),0_3px_4px_rgba(0,0,0,0.05)]">
        <div className="flex gap-3 relative z-10">
          {/* Profile Avatar */}
          {activeAccount ? (
            <Avatar className="w-12 h-12 flex-shrink-0 ring-2 ring-indigo-50 shadow-sm">
              <AvatarImage src={activeAccount.profileImage} alt={`@${activeAccount.username}`} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-600 font-semibold">
                {activeAccount.displayName?.charAt(0) || activeAccount.username?.charAt(0) || 'T'}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-indigo-50 shadow-sm">
              {activeAccountLoading ? (
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              ) : (
                <div className="w-6 h-6 text-indigo-600 font-semibold flex items-center justify-center">
                  {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          )}

          <div className="flex-1">
            {/* Account Info */}
            <div className="flex items-center gap-1 mb-2">
              {activeAccount ? (
                <>
                  <span className="font-medium text-stone-800">
                    {activeAccount.displayName || activeAccount.username}
                  </span>
                  <span className="text-stone-500">
                    @{activeAccount.username}
                  </span>
                </>
              ) : activeAccountLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-stone-200 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-stone-200 rounded animate-pulse"></div>
                </div>
              ) : twitterAccounts && twitterAccounts.length > 0 ? (
                <>
                  <span className="font-medium text-stone-800 text-orange-600">
                    No Active Account
                  </span>
                  <span className="text-stone-500 text-sm">
                    Switch to an account to post
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-stone-800">
                    {session?.user?.name || 'Your Name'}
                  </span>
                  <span className="text-stone-500">
                    @{session?.user?.email?.split('@')[0] || 'username'}
                  </span>
                </>
              )}
            </div>

            {/* Tweet Editor */}
            <div className="text-stone-800 leading-relaxed mb-3">
              <TweetEditor />
            </div>

            {/* Media Files Display */}
            {media.length > 0 && (
              <div className="mt-3">
                {/* Single Image */}
                {media.length === 1 && (
                  <div className="relative group">
                    <div className="relative overflow-hidden rounded-2xl border border-stone-200">
                      <img
                        src={media[0]?.previewUrl}
                        alt="Upload preview"
                        className="w-full max-h-[510px] object-cover"
                      />
                      <button
                        type="button"
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                        onClick={() => removeMedia(media[0]?.id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {media[0]?.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex items-center gap-2 text-white text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{Math.round(media[0].progress || 0)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Two Images */}
                {media.length === 2 && (
                  <div className="grid grid-cols-2 gap-0.5 rounded-2xl overflow-hidden border border-stone-200">
                    {media.map((m) => (
                      <div key={m.id} className="relative group">
                        <div className="relative overflow-hidden h-[254px]">
                          <img
                            src={m.previewUrl}
                            alt="Upload preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                            onClick={() => removeMedia(m.id)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {m.uploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="flex items-center gap-2 text-white text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{Math.round(m.progress || 0)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Three Images */}
                {media.length === 3 && (
                  <div className="grid grid-cols-2 gap-0.5 rounded-2xl overflow-hidden border border-stone-200 h-[254px]">
                    <div className="relative group">
                      <div className="relative overflow-hidden h-full">
                        <img
                          src={media[0]?.previewUrl}
                          alt="Upload preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                          onClick={() => removeMedia(media[0]?.id)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-rows-2 gap-0.5">
                      {media.slice(1).map((m) => (
                        <div key={m.id} className="relative group">
                          <div className="relative overflow-hidden h-full">
                            <img
                              src={m.previewUrl}
                              alt="Upload preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                              onClick={() => removeMedia(m.id)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Four Images */}
                {media.length === 4 && (
                  <div className="grid grid-cols-2 grid-rows-2 gap-0.5 rounded-2xl overflow-hidden border border-stone-200 h-[254px]">
                    {media.map((m) => (
                      <div key={m.id} className="relative group">
                        <div className="relative overflow-hidden h-full">
                          <img
                            src={m.previewUrl}
                            alt="Upload preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                            onClick={() => removeMedia(m.id)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Toolbar */}
            <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-stone-50 p-1.5 rounded-xl border border-stone-200 shadow-sm">
                {/* Media Upload Button */}
                <DuolingoButton
                  variant="secondary"
                  size="icon"
                  className="rounded-md p-2 h-auto w-auto"
                  type="button"
                  onClick={() => document.getElementById('media-upload')?.click()}
                >
                  <Upload className="w-4 h-4" />
                </DuolingoButton>
                <input
                  id="media-upload"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files
                    void handleFilesSelected(files)
                    e.currentTarget.value = ''
                  }}
                />

                {/* Clear Button */}
                <DuolingoButton
                  variant="secondary"
                  size="icon"
                  className="rounded-md p-2 h-auto w-auto"
                  onClick={() => {
                    // Reset the tweet editor content
                    setTweetContent('')
                    setCharCount(0)
                    setMedia([])
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </DuolingoButton>

                <div className="w-px h-4 bg-stone-300 mx-1.5" />

                {/* Character Counter */}
                <div className="flex items-center gap-2">
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="10"
                      fill="none"
                      stroke={overLimit ? '#ef4444' : remaining < 20 ? '#f59e0b' : '#e5e7eb'}
                      strokeWidth="2"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="10"
                      fill="none"
                      stroke={overLimit ? '#ef4444' : '#3b82f6'}
                      strokeWidth="2"
                      strokeDasharray={`${62.83 * Math.min(1, (MAX_TWEET_LEN - remaining) / MAX_TWEET_LEN)} 62.83`}
                      className="transition-all duration-200"
                    />
                  </svg>
                  {remaining < 20 && (
                    <span className={`text-sm font-medium ${overLimit ? 'text-red-500' : 'text-amber-500'}`}>
                      {remaining}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!twitterAccounts?.length ? (
                  <DuolingoButton
                    onClick={async () => {
                      try {
                        const res = await createTwitterLink.refetch()
                        const url = res.data?.url
                        if (url) window.location.href = url
                      } catch (e) {}
                    }}
                    variant="primary"
                    size="md"
                    className="h-11 w-auto"
                  >
                    Connect Twitter
                  </DuolingoButton>
                ) : (
                  <>
                    {/* Post Button */}
                    <DuolingoButton
                      onClick={handleSubmit}
                      disabled={
                        postNow.isPending ||
                        overLimit ||
                        !currentTweet.content.trim() ||
                        hasUploading
                      }
                      variant="primary"
                      size="md"
                      className="h-11 w-auto bg-stone-600 hover:bg-stone-500 border-stone-700 shadow-[0_3px_0_#44403c]"
                      loading={postNow.isPending}
                    >
                      {postNow.isPending ? 'Posting...' : 'Post'}
                    </DuolingoButton>

                    {/* Queue/Schedule Buttons */}
                    <div className="flex">
                      <DuolingoButton
                        onClick={() => {
                          // Add to queue logic
                          const content = currentTweet.content
                          if (content?.trim()) {
                            console.log('Add to queue:', content)
                          }
                        }}
                        disabled={hasUploading}
                        variant="primary"
                        size="md"
                        className="h-11 px-3 rounded-r-none border-r-0 w-auto"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Queue
                      </DuolingoButton>

                      <Popover>
                        <PopoverTrigger asChild>
                          <DuolingoButton
                            disabled={hasUploading}
                            variant="primary"
                            size="icon"
                            className="h-11 w-14 rounded-l-none border-l"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </DuolingoButton>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {scheduledDate ? format(scheduledDate, 'PPP') : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-4">
                                  <Calendar
                                    mode="single"
                                    className='min-w-full'
                                    selected={scheduledDate}
                                    onSelect={setScheduledDate}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="time">Time</Label>
                              <Input
                                id="time"
                                type="time"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                              />
                            </div>
                            <DuolingoButton
                              onClick={handleSchedule}
                              disabled={scheduleTweet.isPending || !scheduledDate || !scheduledTime || 
                                      !currentTweet.content.trim() || hasUploading}
                              variant="primary"
                              size="md"
                              className="w-full"
                              loading={scheduleTweet.isPending}
                            >
                              {scheduleTweet.isPending ? 'Scheduling...' : 'Schedule Tweet'}
                            </DuolingoButton>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {lastTweetId && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800">
            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm"></div>
            <span className="text-sm font-medium">
              Posted! <a href={`https://x.com/i/web/status/${lastTweetId}`} target="_blank" rel="noreferrer" className="underline text-emerald-600 hover:text-emerald-700 transition-colors">View on X</a>
            </span>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {(postNow.error || scheduleTweet.error) && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
          <span className="text-red-600 text-sm font-medium">
            {postNow.error?.message || scheduleTweet.error?.message}
          </span>
        </div>
      )}
      
      {/* Confetti Component */}
      <Confetti ref={confettiRef} />
      </div>
    </div>
  )
}

export default Studio