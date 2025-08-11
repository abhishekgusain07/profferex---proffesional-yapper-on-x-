'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface StreamingMessageProps {
  content: string
  isStreaming?: boolean
  delay?: number
}

export function StreamingMessage({ 
  content, 
  isStreaming = false, 
  delay = 30 
}: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!isStreaming || !content) {
      setDisplayedContent(content)
      setIsComplete(true)
      return
    }

    // Reset state for new streaming content
    setDisplayedContent('')
    setIsComplete(false)

    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex < content.length) {
        setDisplayedContent(content.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, delay)

    return () => clearInterval(interval)
  }, [content, isStreaming, delay])

  // For non-streaming or completed messages, show full content immediately
  if (!isStreaming || isComplete) {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            // Custom styling for markdown elements
            h1: ({ children }) => (
              <h1 className="text-lg font-semibold mb-2">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-semibold mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mb-1">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mb-2 last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm">{children}</li>
            ),
            code: ({ children, className }) => {
              const isInline = !className
              if (isInline) {
                return (
                  <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                )
              }
              return (
                <pre className="bg-gray-100 text-gray-800 p-3 rounded-lg overflow-x-auto text-sm">
                  <code>{children}</code>
                </pre>
              )
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-2">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  // For streaming messages, show partial content with cursor
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Same components as above...
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">
              {children}
              {!isComplete && (
                <span className="animate-pulse ml-1 text-blue-500">▋</span>
              )}
            </p>
          ),
        }}
      >
        {displayedContent}
      </ReactMarkdown>
    </div>
  )
}