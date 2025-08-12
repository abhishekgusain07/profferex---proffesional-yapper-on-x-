'use client'

import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { LexicalEditor } from 'lexical'
import { $generateHtmlFromNodes } from '@lexical/html'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { useTweets } from '@/hooks/use-tweets'

interface TweetProps {
  editMode?: boolean
  editTweetId?: string | null
}

function TweetContentEditable() {
  return (
    <ContentEditable
      className="w-full min-h-16 resize-none text-base leading-relaxed text-stone-800 border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none bg-transparent"
      style={{ whiteSpace: 'pre-wrap' }}
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

function OnTweetChangePlugin() {
  const { setTweetContent, setCharCount } = useTweets()
  const [editor] = useLexicalComposerContext()

  function onChange(editorState: any) {
    editorState.read(() => {
      const root = $getRoot()
      const textContent = root.getTextContent()
      setTweetContent(textContent)
      setCharCount(textContent.length)
    })
  }

  return <OnChangePlugin onChange={onChange} />
}

function SyncWithShadowEditorPlugin() {
  const { shadowEditor } = useTweets()
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const unregisterListener = shadowEditor.registerUpdateListener(({ editorState, tags }) => {
      // Only sync if the update comes from shadow editor (apply button)
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
  }, [editor, shadowEditor])

  return null
}

export default function Tweet({ editMode = false, editTweetId }: TweetProps) {
  return (
    <div className="relative">
      <RichTextPlugin
        contentEditable={<TweetContentEditable />}
        placeholder={<TweetPlaceholder />}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <OnTweetChangePlugin />
      <SyncWithShadowEditorPlugin />
    </div>
  )
}