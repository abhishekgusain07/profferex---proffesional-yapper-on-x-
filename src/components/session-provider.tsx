'use client'

import { useSession } from '@/lib/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, type ReactNode } from 'react'

interface SessionProviderProps {
  children: ReactNode
  initialSession?: {
    user?: {
      id: string
      email: string
      name?: string
    }
  } | null
}

const SessionContext = createContext<{
  session: {
    user?: {
      id: string
      email: string
      name?: string
    }
  } | null
  isLoading: boolean
}>({
  session: null,
  isLoading: true,
})

export function SessionProvider({ children, initialSession }: SessionProviderProps) {
  const queryClient = useQueryClient()
  const { data: session, isLoading } = useSession()

  useEffect(() => {
    if (initialSession && !session && !isLoading) {
      queryClient.setQueryData(['session'], initialSession)
    }
  }, [initialSession, session, isLoading, queryClient])

  return (
    <SessionContext.Provider 
      value={{ 
        session: session || initialSession, 
        isLoading: isLoading && !initialSession 
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSessionContext() {
  return useContext(SessionContext)
}