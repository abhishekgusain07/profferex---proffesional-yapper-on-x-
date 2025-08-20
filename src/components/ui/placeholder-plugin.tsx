import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalIsTextContentEmpty } from '@lexical/react/useLexicalIsTextContentEmpty'
import { useEffect } from 'react'

interface PlaceholderPluginProps {
  placeholder?: string
  className?: string
  // Enhanced contentport-style options
  threadOptimized?: boolean
  showHints?: boolean
}

export default function PlaceholderPlugin({
  placeholder = 'Start typing...',
  className = '',
  threadOptimized = false,
  showHints = false,
}: PlaceholderPluginProps) {
  const [editor] = useLexicalComposerContext()
  const isEmpty = useLexicalIsTextContentEmpty(editor)

  useEffect(() => {
    const element = editor.getRootElement()
    if (!element) return

    // Enhanced placeholder text for thread context
    let finalPlaceholder = placeholder
    if (threadOptimized && isEmpty) {
      finalPlaceholder = showHints 
        ? `${placeholder} (💡 Try "Generate a thread about...")`
        : placeholder
    }

    const update = () => {
      if (isEmpty) {
        element.style.setProperty('--placeholder', `"${finalPlaceholder}"`)
        element.style.setProperty('--placeholder-color', '#9CA3AF') // gray-400
        element.style.setProperty('--placeholder-font-style', 'normal')
        element.classList.add('show-placeholder')
        
        // Add contentport-style placeholder styling
        if (className) {
          element.classList.add(...className.split(' '))
        }
      } else {
        element.classList.remove('show-placeholder')
        if (className) {
          element.classList.remove(...className.split(' '))
        }
      }
    }

    update()

    return editor.registerUpdateListener(() => {
      update()
    })
  }, [editor, isEmpty, placeholder, className, threadOptimized, showHints])

  // Inject CSS for enhanced placeholder styling
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .show-placeholder::before {
        content: var(--placeholder);
        color: var(--placeholder-color, #9CA3AF);
        font-style: var(--placeholder-font-style, normal);
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        pointer-events: none;
        user-select: none;
        display: block;
        line-height: inherit;
      }
      
      .show-placeholder {
        position: relative;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return null
}