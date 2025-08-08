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
import { Loader2, X, Upload, Image as ImageIcon, Video, Calendar as CalendarIcon, Clock, Edit, Trash2 } from 'lucide-react'
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
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [lastTweetId, setLastTweetId] = useState<string | null>(null)
  const [media, setMedia] = useState<LocalMedia[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined)
  const [scheduledTime, setScheduledTime] = useState('')
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const form = useForm<TweetFormValues>({
    resolver: zodResolver(tweetSchema),
    defaultValues: { text: '' },
    mode: 'onChange',
  })

  // tRPC queries
  const { data: hello, isLoading: helloLoading } = trpc.example.hello.useQuery(
    { text: 'tRPC' },
    { enabled: !!session }
  )

  // Twitter OAuth link
  const createTwitterLink = trpc.twitter.createLink.useQuery(
    { action: 'add-account' },
    { enabled: false }
  )
  
  const { data: user, isLoading: userLoading, refetch: refetchUser } = trpc.example.getUser.useQuery(
    undefined,
    { enabled: !!session }
  )

  const { data: twitterAccounts, isLoading: accountsLoading, refetch: refetchAccounts } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { enabled: !!session }
  )

  // tRPC mutations
  const updateProfile = trpc.example.updateProfile.useMutation({
    onSuccess: () => {
      refetchUser()
      setName('')
      setBio('')
    },
  })

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
      setScheduledTime('')
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

  // Generate default schedule time (30 minutes from now)
  const getDefaultScheduleTime = () => {
    const now = new Date()
    const defaultTime = addMinutes(now, 30)
    return format(defaultTime, 'HH:mm')
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

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    updateProfile.mutate({
      name: name.trim(),
      bio: bio.trim() || undefined,
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Studio</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              try {
                const res = await createTwitterLink.refetch()
                const url = res.data?.url
                if (url) window.location.href = url
              } catch (e) {}
            }}
          >
            Connect Twitter
          </Button>
          <Button variant="outline" onClick={() => signOut()}>
            Logout
          </Button>
        </div>
      </div>

      {/* Tweet Composer with Scheduling */}
      <Tabs defaultValue="composer" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="composer">Compose</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduledTweets?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="composer">
          <Card>
            <CardHeader>
              <CardTitle>Tweet Composer</CardTitle>
              <CardDescription>
                {isScheduling ? 'Schedule your tweet for later' : 'Write and post to Twitter immediately'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
                {/* Scheduling Toggle */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="scheduling-mode"
                    checked={isScheduling}
                    onCheckedChange={setIsScheduling}
                  />
                  <Label htmlFor="scheduling-mode">Schedule for later</Label>
                </div>

                {/* Date and Time Picker (only when scheduling) */}
                {isScheduling && (
                  <div className="grid grid-cols-2 gap-4">
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
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={scheduledTime || getDefaultScheduleTime()}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <Textarea
                  {...form.register('text')}
                  placeholder="What's happening?"
                  maxLength={MAX_TWEET_LEN + 50}
                  className="min-h-32"
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {accountsLoading
                      ? 'Checking accounts…'
                      : twitterAccounts && twitterAccounts.length > 0
                      ? `Connected accounts: ${twitterAccounts.length}`
                      : 'No Twitter accounts connected'}
                  </span>
                  <span className={overLimit ? 'text-red-600' : ''}>{remaining}</span>
                </div>

                {/* Media Picker */}
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 border rounded cursor-pointer">
                    <Upload className="size-4" />
                    <span>Add media</span>
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
                  <span className="text-xs text-muted-foreground">
                    Up to 4 images. JPEG or PNG only.
                  </span>
                </div>

                {/* Media Preview */}
                {media.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {media.map((m) => (
                      <div key={m.id} className="relative border rounded overflow-hidden">
                        {m.mediaType === 'image' || m.mediaType === 'gif' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.previewUrl} alt="preview" className="w-full h-32 object-cover" />
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center bg-muted text-muted-foreground">
                            <Video className="size-6" />
                            <span className="ml-2 text-sm">Video</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className="absolute top-1 right-1 inline-flex items-center justify-center bg-black/60 text-white rounded p-1"
                          onClick={() => removeMedia(m.id)}
                        >
                          <X className="size-4" />
                        </button>
                        {(m.uploading || m.error) && (
                          <div className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center text-xs">
                            {m.uploading ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Loader2 className="size-4 animate-spin" />
                                  <span>Uploading… {Math.round(m.progress)}%</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-red-300">{m.error}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
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
                  >
                    {(isScheduling ? scheduleTweet.isPending : postNow.isPending) ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {isScheduling ? 'Scheduling…' : 'Posting…'}
                      </span>
                    ) : (
                      isScheduling ? 'Schedule Tweet' : 'Post Now'
                    )}
                  </Button>
                  {(postNow.error || scheduleTweet.error) && (
                    <span className="text-sm text-red-600">
                      {postNow.error?.message || scheduleTweet.error?.message}
                    </span>
                  )}
                  {lastTweetId && (
                    <span className="text-sm">
                      Posted: <a href={`https://x.com/i/web/status/${lastTweetId}`} target="_blank" rel="noreferrer" className="underline">View</a>
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Tweets</CardTitle>
              <CardDescription>Manage your scheduled tweets</CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledTweets && scheduledTweets.length > 0 ? (
                <div className="space-y-4">
                  {scheduledTweets.map((tweet:any) => (
                    <div key={tweet.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <p className="text-sm flex-1">{tweet.content}</p>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelScheduled.mutate({ tweetId: tweet.id })}
                            disabled={cancelScheduled.isPending}
                          >
                            {cancelScheduled.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>
                          Scheduled for {tweet.scheduledFor ? format(new Date(tweet.scheduledFor), 'PPP p') : 'Unknown'}
                        </span>
                      </div>
                      {tweet.mediaIds && tweet.mediaIds.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          📎 {tweet.mediaIds.length} media attachment{tweet.mediaIds.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="size-8 mx-auto mb-2" />
                  <p>No scheduled tweets</p>
                  <p className="text-sm">Use the composer tab to schedule your first tweet!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hello Query Example */}
      <Card>
        <CardHeader>
          <CardTitle>Hello Query</CardTitle>
          <CardDescription>Testing basic tRPC query</CardDescription>
        </CardHeader>
        <CardContent>
          {helloLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading greeting...</span>
            </div>
          ) : (
            <div>
              <p className="text-lg">{hello?.greeting}</p>
              <p className="text-sm text-muted-foreground">
                Timestamp: {hello?.timestamp}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Info Query */}
      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
          <CardDescription>Protected tRPC query</CardDescription>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading user data...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p><strong>Email:</strong> {user?.user.email}</p>
              <p><strong>Name:</strong> {user?.user.name || 'Not set'}</p>
              <p className="text-sm text-muted-foreground">{user?.message}</p>
              <div className="mt-4">
                <p className="font-semibold">Twitter accounts</p>
                {accountsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Loading…</span>
                  </div>
                ) : twitterAccounts && twitterAccounts.length > 0 ? (
                  <ul className="text-sm list-disc pl-6">
                    {twitterAccounts.map((a) => (
                      <li key={a.id}>Account ID: {a.accountId}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No Twitter accounts connected.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Profile Mutation */}
      <Card>
        <CardHeader>
          <CardTitle>Update Profile</CardTitle>
          <CardDescription>Test tRPC mutation</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="bio" className="block text-sm font-medium mb-1">
                Bio (optional)
              </label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
                maxLength={160}
              />
            </div>

            <Button 
              type="submit" 
              disabled={updateProfile.isPending || !name.trim()}
              className="w-full"
            >
              {updateProfile.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Updating...</span>
                </div>
              ) : (
                'Update Profile'
              )}
            </Button>

            {updateProfile.error && (
              <p className="text-sm text-red-600">
                Error: {updateProfile.error.message}
              </p>
            )}

            {updateProfile.isSuccess && (
              <p className="text-sm text-green-600">
                Profile updated successfully!
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Studio