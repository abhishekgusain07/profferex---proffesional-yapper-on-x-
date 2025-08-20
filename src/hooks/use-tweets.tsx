import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
  useState,
} from 'react'
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical'
import { nanoid } from 'nanoid'

interface TweetImage {
  src: string
  originalSrc: string
  width: number
  height: number
}

export const initialConfig = {
  namespace: `tweet-editor`,
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

interface TweetContextType {
  // Single tweet support (existing)
  currentTweet: { id: string; content: string; image?: TweetImage; mediaIds: string[] }
  shadowEditor: ReturnType<typeof createEditor>
  setTweetContent: (content: string) => void
  removeTweetImage: () => void
  setCurrentTweet: React.Dispatch<React.SetStateAction<CurrentTweet>>
  mediaFiles: MediaFile[]
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>
  charCount: number
  setCharCount: React.Dispatch<React.SetStateAction<number>>
  
  // Thread support (new)
  tweets: Tweet[]
  addTweet: ({ initialContent, index }: { initialContent: string; index?: number }) => void
  updateTweet: (id: string, content: string) => void
  removeTweet: (id: string) => void
  resetTweets: () => Promise<void>
}

const TweetContext = createContext<TweetContextType | undefined>(undefined)

export type CurrentTweet = {
  id: string
  content: string
  image?: TweetImage
  mediaIds: string[]
}

export type Tweet = {
  id: string
  content: string
  image?: TweetImage
  mediaIds: string[]
  index: number
  editor: ReturnType<typeof createEditor>
}

export interface MediaFile {
  file: File | null
  url: string
  type: 'image' | 'gif' | 'video'
  uploading: boolean
  uploaded: boolean
  error?: string
  media_id?: string
  media_key?: string
  s3Key?: string
}

export function TweetProvider({ children }: PropsWithChildren) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])

  const [currentTweet, setCurrentTweet] = useState<CurrentTweet>({
    id: nanoid(),
    content: '',
    mediaIds: [],
  })

  const [charCount, setCharCount] = useState(0)
  
  // Thread state management
  const initialTweetId = useRef(nanoid())
  const [tweets, setTweets] = useState<Tweet[]>([
    {
      id: initialTweetId.current,
      content: '',
      mediaIds: [],
      index: 0,
      editor: createEditor({ ...initialConfig }),
    }
  ])

  const shadowEditorRef = useRef(createEditor({ ...initialConfig }))
  const shadowEditor = shadowEditorRef.current

  const setTweetContent = (content: string) => {
    setCurrentTweet((prev) => ({ ...prev, content }))
  }

  const removeTweetImage = () => {
    setCurrentTweet((prev) => ({ ...prev, image: undefined }))
  }

  // Thread management functions
  const addTweet = ({ initialContent, index }: { initialContent: string; index?: number }) => {
    const newTweet: Tweet = {
      id: nanoid(),
      content: initialContent,
      mediaIds: [],
      index: index ?? tweets.length,
      editor: createEditor({ ...initialConfig }),
    }

    // Initialize the editor with content
    newTweet.editor.update(() => {
      const root = $getRoot()
      root.clear()
      const paragraph = $createParagraphNode()
      const textNode = $createTextNode(initialContent)
      paragraph.append(textNode)
      root.append(paragraph)
    })

    setTweets((prev) => {
      const newTweets = [...prev]
      if (index !== undefined) {
        newTweets.splice(index, 0, newTweet)
        // Reindex all tweets after insertion
        return newTweets.map((tweet, idx) => ({ ...tweet, index: idx }))
      } else {
        newTweets.push(newTweet)
        return newTweets
      }
    })
  }

  const updateTweet = (id: string, content: string) => {
    setTweets((prev) => 
      prev.map((tweet) => {
        if (tweet.id === id) {
          // Update the editor content with proper sync
          tweet.editor.update(
            () => {
              const root = $getRoot()
              root.clear()
              const paragraph = $createParagraphNode()
              const textNode = $createTextNode(content)
              paragraph.append(textNode)
              root.append(paragraph)
            },
            { tag: 'force-sync' }
          )
          return { ...tweet, content }
        }
        return tweet
      })
    )
  }

  const removeTweet = (id: string) => {
    setTweets((prev) => 
      prev
        .filter((tweet) => tweet.id !== id)
        .map((tweet, index) => ({ ...tweet, index })) // Reindex
    )
  }

  const resetTweets = async () => {
    // Clear editor content for all existing tweets
    await Promise.all(
      tweets.map(async (tweet) => {
        if (tweet.editor) {
          await new Promise<void>((resolve) => {
            tweet.editor.update(
              () => {
                const root = $getRoot()
                root.clear()
                const paragraph = $createParagraphNode()
                root.append(paragraph)
              },
              { onUpdate: resolve, tag: 'force-sync' },
            )
          })
        }
      })
    )

    // Create a new tweet with fresh editor
    const newTweetId = nanoid()
    const newEditor = createEditor({ ...initialConfig })
    
    // Initialize the new editor with empty paragraph
    await new Promise<void>((resolve) => {
      newEditor.update(
        () => {
          const root = $getRoot()
          const paragraph = $createParagraphNode()
          root.append(paragraph)
        },
        { onUpdate: resolve, tag: 'force-sync' },
      )
    })

    setTweets([
      {
        id: newTweetId,
        content: '',
        mediaIds: [],
        index: 0,
        editor: newEditor,
      }
    ])
  }

  return (
    <TweetContext.Provider
      value={{
        // Single tweet support (existing)
        charCount,
        setCharCount,
        currentTweet,
        setCurrentTweet,
        shadowEditor,
        mediaFiles,
        setMediaFiles,
        setTweetContent,
        removeTweetImage,
        
        // Thread support (new)
        tweets,
        addTweet,
        updateTweet,
        removeTweet,
        resetTweets,
      }}
    >
      {children}
    </TweetContext.Provider>
  )
}

export function useTweets() {
  const context = useContext(TweetContext)
  if (context === undefined) {
    throw new Error('useTweets must be used within a TweetProvider')
  }
  return context
}