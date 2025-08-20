import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface StreamingMessageProps {
  text: string
  animate?: boolean
  markdown?: boolean
}

export const StreamingMessage = ({
  text,
  animate = false,
  markdown = false,
}: StreamingMessageProps) => {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text)
      return
    }

    setDisplayedText('')
    let index = 0
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 20)

    return () => clearInterval(interval)
  }, [text, animate])

  if (markdown) {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{displayedText}</ReactMarkdown>
      </div>
    )
  }

  return <span>{displayedText}</span>
}