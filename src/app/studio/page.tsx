'use client'

import { useState, useMemo, useRef } from 'react'
import { trpc } from '@/trpc/client'
import { useSession, signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, X, Upload, Calendar as CalendarIcon, Clock, Trash2, Send, Image as ImageIcon, Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, addMinutes } from 'date-fns'

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
  const [lastTweetId, setLastTweetId] = useState<string | null>(null)
  const [media, setMedia] = useState<LocalMedia[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined)
  const [scheduledTime, setScheduledTime] = useState('09:00')
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
    },
  })

  const scheduleTweet = trpc.twitter.schedule.useMutation({
    onSuccess: () => {
      form.reset({ text: '' })
      setMedia([])
      setScheduledDate(undefined)
      setScheduledTime('09:00')
      setIsScheduling(false)
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

  const remaining = useMemo(() => MAX_TWEET_LEN - (form.watch('text')?.length || 0), [form.watch('text')])
  const overLimit = remaining < 0

  // Initialize scheduling time when toggle is enabled
  const initializeSchedulingTime = () => {
    if (!scheduledTime || scheduledTime === '09:00') {
      const now = new Date()
      const defaultTime = addMinutes(now, 30)
      setScheduledTime(format(defaultTime, 'HH:mm'))
    }
  }

  // Combine date and time into Unix timestamp
  const getScheduledUnix = () => {
    if (!scheduledDate || !scheduledTime) return null
    const [hours, minutes] = scheduledTime.split(':').map(Number)
    const combined = new Date(scheduledDate)
    combined.setHours(hours, minutes, 0, 0)
    return Math.floor(combined.getTime() / 1000)
  }

  // Handle form submission (post now or schedule)
  const handleSubmit = (values: TweetFormValues) => {
    if (isScheduling) {
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
        text: values.text.trim(),
        scheduledUnix,
        mediaIds,
      })
    } else {
      postNow.mutate({ text: values.text.trim(), mediaIds })
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="border-b bg-white/70 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Twitter Studio</h1>
                <p className="text-sm text-slate-600">Create and schedule your posts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!twitterAccounts?.length && (
                <Button
                  onClick={async () => {
                    try {
                      const res = await createTwitterLink.refetch()
                      const url = res.data?.url
                      if (url) window.location.href = url
                    } catch (e) {}
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Connect Twitter
                </Button>
              )}
              <Button variant="ghost" onClick={() => signOut()}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Main Content */}
        <Tabs defaultValue="composer" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="composer" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Send className="w-4 h-4 mr-2" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Clock className="w-4 h-4 mr-2" />
              Scheduled ({scheduledTweets?.length || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="composer" className="mt-0">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                    <Send className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Create Post</CardTitle>
                    <CardDescription className="text-sm">
                      {isScheduling ? 'Schedule your post for later' : 'Share your thoughts with the world'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  {/* Tweet Textarea */}
                  <div className="space-y-3">
                    <Textarea
                      {...form.register('text')}
                      placeholder="What's happening?"
                      className="min-h-32 text-lg border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 bg-white/50"
                      maxLength={MAX_TWEET_LEN + 50}
                    />
                    
                    {/* Character Count */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Media Upload Button */}
                        <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer group">
                          <ImageIcon className="w-4 h-4 group-hover:text-blue-600" />
                          <span>Add photos</span>
                          <input
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
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${overLimit ? 'text-red-500' : remaining < 20 ? 'text-amber-500' : 'text-slate-500'}`}>
                          {remaining}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Media Preview */}
                  {media.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {media.map((m) => (
                        <div key={m.id} className="relative aspect-video border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          {m.mediaType === 'image' || m.mediaType === 'gif' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.previewUrl} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                            onClick={() => removeMedia(m.id)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {(m.uploading || m.error) && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              {m.uploading ? (
                                <div className="flex items-center gap-2 text-white text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>{Math.round(m.progress)}%</span>
                                </div>
                              ) : (
                                <span className="text-red-200 text-xs px-2">{m.error}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Schedule Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="scheduling-mode"
                        checked={isScheduling}
                        onCheckedChange={(checked) => {
                          setIsScheduling(checked)
                          if (checked) {
                            initializeSchedulingTime()
                            if (!scheduledDate) {
                              setScheduledDate(new Date())
                            }
                          }
                        }}
                      />
                      <Label htmlFor="scheduling-mode" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Schedule for later
                      </Label>
                    </div>
                  </div>

                  {/* Date and Time Picker */}
                  {isScheduling && (
                    <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-white"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduledDate ? format(scheduledDate, 'PPP') : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={scheduledDate}
                                onSelect={setScheduledDate}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time" className="text-sm font-medium">Time</Label>
                          <Input
                            id="time"
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>
                      
                      {/* Quick Time Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: '+5min', minutes: 5 },
                          { label: '+30min', minutes: 30 },
                          { label: '+1hr', minutes: 60 },
                          { label: '9AM', time: '09:00' },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs bg-white/50"
                            onClick={() => {
                              if (preset.time) {
                                setScheduledTime(preset.time)
                              } else if (preset.minutes) {
                                const now = new Date()
                                const newTime = addMinutes(now, preset.minutes)
                                setScheduledTime(format(newTime, 'HH:mm'))
                              }
                            }}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>

                      {/* Schedule Preview */}
                      {scheduledDate && scheduledTime && (
                        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
                          <Clock className="w-4 h-4" />
                          <span>
                            Will post on <strong>{format(scheduledDate, 'PPP')} at {scheduledTime}</strong>
                            {(() => {
                              const scheduledUnix = getScheduledUnix()
                              if (scheduledUnix) {
                                const scheduledDateTime = new Date(scheduledUnix * 1000)
                                const now = new Date()
                                const diffMinutes = Math.round((scheduledDateTime.getTime() - now.getTime()) / (1000 * 60))
                                if (diffMinutes < 60) {
                                  return ` (in ${diffMinutes} minutes)`
                                } else if (diffMinutes < 1440) {
                                  return ` (in ${Math.round(diffMinutes / 60)} hours)`
                                } else {
                                  return ` (in ${Math.round(diffMinutes / 1440)} days)`
                                }
                              }
                              return ''
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connection Status */}
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                    {accountsLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking accounts...</span>
                      </div>
                    ) : twitterAccounts && twitterAccounts.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Connected to {twitterAccounts.length} Twitter account{twitterAccounts.length > 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>No Twitter accounts connected</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                    <Button
                      type="submit"
                      disabled={
                        (isScheduling ? scheduleTweet.isPending : postNow.isPending) ||
                        overLimit ||
                        !form.getValues('text')?.trim() ||
                        !twitterAccounts?.length ||
                        hasUploading ||
                        (isScheduling && (!scheduledDate || !scheduledTime))
                      }
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                    >
                      {(isScheduling ? scheduleTweet.isPending : postNow.isPending) ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {isScheduling ? 'Scheduling...' : 'Posting...'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {isScheduling ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          {isScheduling ? 'Schedule Post' : 'Post Now'}
                        </span>
                      )}
                    </Button>

                    {(postNow.error || scheduleTweet.error) && (
                      <span className="text-sm text-red-600">
                        {postNow.error?.message || scheduleTweet.error?.message}
                      </span>
                    )}

                    {lastTweetId && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>
                          Posted! <a href={`https://x.com/i/web/status/${lastTweetId}`} target="_blank" rel="noreferrer" className="underline font-medium">View on X</a>
                        </span>
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-0">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Scheduled Posts</CardTitle>
                    <CardDescription>Manage your upcoming posts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {scheduledTweets && scheduledTweets.length > 0 ? (
                  <div className="space-y-4">
                    {scheduledTweets.map((tweet: any) => (
                      <div key={tweet.id} className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <p className="text-slate-900 leading-relaxed">{tweet.content}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Clock className="w-3 h-3" />
                              <span>
                                {tweet.scheduledFor ? format(new Date(tweet.scheduledFor), 'PPP p') : 'Unknown time'}
                              </span>
                            </div>
                            {tweet.mediaIds && tweet.mediaIds.length > 0 && (
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <ImageIcon className="w-3 h-3" />
                                <span>{tweet.mediaIds.length} photo{tweet.mediaIds.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
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
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No scheduled posts</h3>
                    <p className="text-slate-600 mb-6">Create your first scheduled post using the composer!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Studio