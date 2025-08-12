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
  currentTweet: { id: string; content: string; image?: TweetImage; mediaIds: string[] }
  shadowEditor: ReturnType<typeof createEditor>
  setTweetContent: (content: string) => void
  removeTweetImage: () => void
  setCurrentTweet: React.Dispatch<React.SetStateAction<CurrentTweet>>
  mediaFiles: MediaFile[]
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>
  charCount: number
  setCharCount: React.Dispatch<React.SetStateAction<number>>
}

const TweetContext = createContext<TweetContextType | undefined>(undefined)

export type CurrentTweet = {
  id: string
  content: string
  image?: TweetImage
  mediaIds: string[]
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

  const shadowEditorRef = useRef(createEditor({ ...initialConfig }))
  const shadowEditor = shadowEditorRef.current

  const setTweetContent = (content: string) => {
    setCurrentTweet((prev) => ({ ...prev, content }))
  }

  const removeTweetImage = () => {
    setCurrentTweet((prev) => ({ ...prev, image: undefined }))
  }

  return (
    <TweetContext.Provider
      value={{
        charCount,
        setCharCount,
        currentTweet,
        setCurrentTweet,
        shadowEditor,
        mediaFiles,
        setMediaFiles,
        setTweetContent,
        removeTweetImage,
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