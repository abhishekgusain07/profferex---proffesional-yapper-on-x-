import { useEffect, useCallback } from 'react'

interface KeyboardShortcutOptions {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  preventDefault?: boolean
  enabled?: boolean
}

/**
 * Global keyboard shortcut hook with platform-aware modifier detection
 * Automatically detects Mac (Cmd) vs Windows/Linux (Ctrl) for platform consistency
 */
export function useKeyboardShortcut(
  callback: () => void,
  options: KeyboardShortcutOptions | KeyboardShortcutOptions[]
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const optionsArray = Array.isArray(options) ? options : [options]
      
      for (const option of optionsArray) {
        const {
          key,
          ctrlKey = false,
          metaKey = false,
          altKey = false,
          shiftKey = false,
          preventDefault = true,
          enabled = true,
        } = option

        if (!enabled) continue

        // Check if the key matches (case insensitive)
        const keyMatches = event.key.toLowerCase() === key.toLowerCase()
        
        // Check modifier keys
        const ctrlMatches = ctrlKey === event.ctrlKey
        const metaMatches = metaKey === event.metaKey
        const altMatches = altKey === event.altKey
        const shiftMatches = shiftKey === event.shiftKey

        if (keyMatches && ctrlMatches && metaMatches && altMatches && shiftMatches) {
          if (preventDefault) {
            event.preventDefault()
            event.stopPropagation()
          }
          callback()
          return
        }
      }
    },
    [callback, options]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

/**
 * Platform-aware shortcut for Cmd+L (Mac) or Ctrl+L (Windows/Linux)
 */
export function useCmdL(callback: () => void, enabled = true) {
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  useKeyboardShortcut(
    callback,
    {
      key: 'l',
      metaKey: isMac,
      ctrlKey: !isMac,
      preventDefault: true,
      enabled,
    }
  )
}

/**
 * Common keyboard shortcuts with platform detection
 */
export const useCommonShortcuts = {
  /**
   * Cmd+K (Mac) or Ctrl+K (Windows/Linux) - Command palette style
   */
  cmdK: (callback: () => void, enabled = true) => {
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    
    useKeyboardShortcut(
      callback,
      {
        key: 'k',
        metaKey: isMac,
        ctrlKey: !isMac,
        preventDefault: true,
        enabled,
      }
    )
  },

  /**
   * Escape key - Close modals/sidebars
   */
  escape: (callback: () => void, enabled = true) => {
    useKeyboardShortcut(
      callback,
      {
        key: 'Escape',
        preventDefault: false, // Don't prevent escape by default
        enabled,
      }
    )
  },

  /**
   * Enter key
   */
  enter: (callback: () => void, enabled = true) => {
    useKeyboardShortcut(
      callback,
      {
        key: 'Enter',
        preventDefault: false,
        enabled,
      }
    )
  },
}