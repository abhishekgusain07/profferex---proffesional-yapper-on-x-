'use client'

import { AccountAvatar, AccountName, AccountHandle } from '@/hooks/use-account'
import { useTweets, Tweet } from '@/hooks/use-tweets'
import { cn } from '@/lib/utils'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { Upload, Trash2, X } from 'lucide-react'
import DuolingoButton from '@/components/ui/duolingo-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEffect, useState, useCallback, useRef } from 'react'
import { trpc } from '@/trpc/client'

const initialConfig = {
  namespace: 'tweet-editor-item',
  theme: {
    text: {
      bold: 'font-bold',
      italic: 'italic',
      underline: 'underline',
    },
  },
  onError: (error: Error) => {
    console.error('[Tweet Editor Error]', error)
  },
  nodes: [],
}

interface TweetItemProps {
  tweet: Tweet
  index: number
}

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

function TweetContentEditable() {
  return (
    <ContentEditable
      className="w-full !min-h-16 resize-none text-base/7 leading-relaxed text-stone-800 border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none"
      spellCheck={false}
    />
  )
}

function TweetPlaceholder() {
  return (
    <div className="absolute top-0 left-0 text-stone-500 text-base leading-relaxed pointer-events-none">
      What's happening?
    </div>
  )
}

function OnTweetChangePlugin({ tweet }: { tweet: Tweet }) {
  const { updateTweet } = useTweets()
  const [editor] = useLexicalComposerContext()

  function onChange(editorState: any) {
    editorState.read(() => {
      const root = $getRoot()
      const textContent = root.getTextContent()
      updateTweet(tweet.id, textContent)
    })
  }

  return <OnChangePlugin onChange={onChange} />
}

function SyncWithTweetPlugin({ tweet }: { tweet: Tweet }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (tweet.editor) {
      const unregisterListener = tweet.editor.registerUpdateListener(({ editorState, tags }) => {
        // Only sync if the update comes from the tweet's shadow editor (apply button)
        if (tags.has('force-sync')) {
          editorState.read(() => {
            const root = $getRoot()
            const textContent = root.getTextContent()
            
            // Update the main editor
            editor.update(() => {
              const mainRoot = $getRoot()
              const paragraph = $createParagraphNode()
              const textNode = $createTextNode(textContent)
              
              mainRoot.clear()
              paragraph.append(textNode)
              mainRoot.append(paragraph)
            })
          })
        }
      })

      return () => {
        unregisterListener()
      }
    }
  }, [editor, tweet.editor])

  // Initial sync of content
  useEffect(() => {
    if (tweet.content) {
      editor.update(() => {
        const root = $getRoot()
        const paragraph = $createParagraphNode()
        const textNode = $createTextNode(tweet.content)
        
        root.clear()
        paragraph.append(textNode)
        root.append(paragraph)
      })
    }
  }, [editor, tweet.content])

  return null
}

export const TweetItem = ({ tweet, index }: TweetItemProps) => {
  const { removeTweet } = useTweets()
  const [media, setMedia] = useState<LocalMedia[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const config = {
    ...initialConfig,
    namespace: `tweet-editor-${tweet.id}`,
  }

  const uploadMediaFromR2 = trpc.twitter.uploadMediaFromR2.useMutation({
    onError: (err, vars) => {
      setMedia((prev) => prev.map((m) => (m.id === vars.r2Key ? { ...m, uploading: false, error: err.message } : m)))
    },
  })

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files) return

    for (const file of Array.from(files)) {
      // Simple validation - only allow images for now
      if (!file.type.startsWith('image/')) {
        continue
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const previewUrl = URL.createObjectURL(file)
      const local: LocalMedia = {
        id,
        file,
        previewUrl,
        mediaType: 'image',
        uploading: true,
        progress: 0,
      }
      setMedia((prev) => [...prev, local])

      try {
        // Upload to R2 first
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
        setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, progress: 100 } : m)))

        // Exchange for Twitter media_id
        const { media_id } = await uploadMediaFromR2.mutateAsync({ r2Key: key, mediaType: 'image' })
        setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, progress: 100, r2Key: key, media_id } : m)))
      } catch (err: any) {
        setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, error: err.message || 'Upload failed' } : m)))
      }
    }
  }, [uploadMediaFromR2])

  const removeMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="relative p-3 border-2 border-transparent border-dashed bg-white rounded-xl w-full transition-colors">
      <div className="w-full flex gap-3 relative">
        <div className="relative z-50 w-10 h-14 bg-white flex -top-2.5 items-center justify-center transition-colors">
          <AccountAvatar className="relative !z-50 size-10" />
        </div>

        <div className="w-full flex-1">
          <div className="flex items-center gap-1">
            <AccountName />
            <AccountHandle />
          </div>

          <div className="text-stone-800 leading-relaxed">
            <LexicalComposer initialConfig={config}>
              <div className="relative">
                <RichTextPlugin
                  contentEditable={<TweetContentEditable />}
                  placeholder={<TweetPlaceholder />}
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <OnTweetChangePlugin tweet={tweet} />
                <SyncWithTweetPlugin tweet={tweet} />
              </div>
            </LexicalComposer>
          </div>

          {/* Media Files Display */}
          {media.length > 0 && (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="relative group">
                    <div className="relative overflow-hidden rounded-lg border border-stone-200">
                      <img
                        src={m.previewUrl}
                        alt="Upload preview"
                        className="w-full h-32 object-cover"
                      />
                      <button
                        type="button"
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                        onClick={() => removeMedia(m.id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {m.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex items-center gap-2 text-white text-xs">
                            <span>{Math.round(m.progress || 0)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tweet actions */}
          <div className="mt-3 w-full flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-stone-100 p-1.5 rounded-lg transition-colors">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DuolingoButton
                      variant="secondary"
                      size="icon"
                      className="rounded-md"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-4" />
                      <span className="sr-only">Upload files</span>
                    </DuolingoButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Upload media</p>
                  </TooltipContent>
                </Tooltip>

                {index !== 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DuolingoButton
                        variant="secondary"
                        size="icon"
                        className="rounded-md"
                        onClick={() => removeTweet(tweet.id)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remove tweet</span>
                      </DuolingoButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Remove tweet</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>

              <div className="w-px h-4 bg-stone-300 mx-2" />

              {/* Character count indicator placeholder */}
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray={`${50.27 * Math.min(1, tweet.content.length / 280)} 50.27`}
                    className="transition-all duration-200"
                  />
                </svg>
                {tweet.content.length > 260 && (
                  <span className={`text-xs font-medium ${
                    tweet.content.length > 280 ? 'text-red-500' : 'text-amber-500'
                  }`}>
                    {280 - tweet.content.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        multiple
        onChange={(e) => {
          handleFilesSelected(e.target.files)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}

TweetItem.displayName = 'TweetItem'