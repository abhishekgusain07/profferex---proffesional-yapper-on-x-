'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface LoadingContextType {
  isPageLoading: boolean
  loadingMessage: string
  setPageLoading: (loading: boolean, message?: string) => void
  startPageTransition: (message?: string) => void
  endPageTransition: () => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  const setPageLoading = useCallback((loading: boolean, message = '') => {
    setIsPageLoading(loading)
    setLoadingMessage(message)
  }, [])

  const startPageTransition = useCallback((message = 'Loading...') => {
    setPageLoading(true, message)
  }, [setPageLoading])

  const endPageTransition = useCallback(() => {
    setPageLoading(false, '')
  }, [setPageLoading])

  return (
    <LoadingContext.Provider value={{
      isPageLoading,
      loadingMessage,
      setPageLoading,
      startPageTransition,
      endPageTransition
    }}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoadingState() {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoadingState must be used within a LoadingProvider')
  }
  return context
}

// Hook for automatic loading states on navigation
export function usePageLoadingEffect(dependencies: any[] = []) {
  const { startPageTransition, endPageTransition } = useLoadingState()
  
  // Auto-start loading on dependency changes
  useState(() => {
    startPageTransition()
    const timer = setTimeout(() => endPageTransition(), 100)
    return () => clearTimeout(timer)
  })
}