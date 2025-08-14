'use client'

import { createContext, PropsWithChildren, useContext, useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { useBackgroundRefresh, warmNavCache } from '@/lib/prefetch-utils'

interface TwitterDataProviderProps extends PropsWithChildren {
  initialTwitterData?: {
    accounts?: any[] | null
    activeAccount?: any | null
  } | null
}

const TwitterDataContext = createContext<{
  accounts: any[] | null
  activeAccount: any | null
  isLoading: boolean
}>({
  accounts: null,
  activeAccount: null,
  isLoading: true,
})

export function TwitterDataProvider({ children, initialTwitterData }: TwitterDataProviderProps) {
  const queryClient = useQueryClient()
  
  // Enable background refresh and cache warming
  useBackgroundRefresh()
  warmNavCache()
  
  // Use tRPC hooks with smart caching - stale-while-revalidate pattern
  const { data: accounts, isLoading: accountsLoading } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { 
      initialData: initialTwitterData?.accounts,
      staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
      cacheTime: 60 * 60 * 1000, // Keep in cache for 1 hour
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    }
  )
  
  const { data: activeAccount, isLoading: activeAccountLoading } = trpc.twitter.getActiveAccount.useQuery(
    undefined,
    {
      initialData: initialTwitterData?.activeAccount,
      staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
      cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      refetchOnWindowFocus: true, // Refresh active account on focus for real-time updates
      refetchOnMount: false,
      refetchOnReconnect: true,
    }
  )

  // Hydrate React Query cache with server data on mount
  useEffect(() => {
    if (initialTwitterData?.accounts) {
      queryClient.setQueryData(['twitter', 'getAccounts'], initialTwitterData.accounts)
    }
    if (initialTwitterData?.activeAccount) {
      queryClient.setQueryData(['twitter', 'getActiveAccount'], initialTwitterData.activeAccount)
    }
  }, [initialTwitterData, queryClient])

  return (
    <TwitterDataContext.Provider 
      value={{ 
        accounts: accounts || initialTwitterData?.accounts || null,
        activeAccount: activeAccount || initialTwitterData?.activeAccount || null,
        isLoading: (accountsLoading || activeAccountLoading) && !initialTwitterData
      }}
    >
      {children}
    </TwitterDataContext.Provider>
  )
}

export function useTwitterData() {
  const context = useContext(TwitterDataContext)
  if (!context) {
    throw new Error('useTwitterData must be used within a TwitterDataProvider')
  }
  return context
}

// Helper hook for cache operations - to be used in components/mutations
export function useTwitterDataOperations() {
  const queryClient = useQueryClient()
  
  return {
    invalidateTwitterAccounts: () => {
      queryClient.invalidateQueries({ queryKey: ['twitter', 'getAccounts'] })
      queryClient.invalidateQueries({ queryKey: ['twitter', 'getActiveAccount'] })
    },
    optimisticallyUpdateActiveAccount: (newActiveAccount: any) => {
      queryClient.setQueryData(['twitter', 'getActiveAccount'], newActiveAccount)
    },
    invalidateAccountsOnly: () => {
      queryClient.invalidateQueries({ queryKey: ['twitter', 'getAccounts'] })
    }
  }
}