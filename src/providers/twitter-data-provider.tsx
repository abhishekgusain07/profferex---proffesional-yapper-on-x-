'use client'

import { createContext, PropsWithChildren, useContext, useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { useQueryClient } from '@tanstack/react-query'

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
  
  // Use tRPC hooks to get current data
  const { data: accounts, isLoading: accountsLoading } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { 
      initialData: initialTwitterData?.accounts,
      staleTime: 30 * 1000, // Consider fresh for 30 seconds
    }
  )
  
  const { data: activeAccount, isLoading: activeAccountLoading } = trpc.twitter.getActiveAccount.useQuery(
    undefined,
    {
      initialData: initialTwitterData?.activeAccount,
      staleTime: 30 * 1000, // Consider fresh for 30 seconds
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
      queryClient.invalidateQueries(['twitter', 'getAccounts'])
      queryClient.invalidateQueries(['twitter', 'getActiveAccount'])
    },
    optimisticallyUpdateActiveAccount: (newActiveAccount: any) => {
      queryClient.setQueryData(['twitter', 'getActiveAccount'], newActiveAccount)
    },
    invalidateAccountsOnly: () => {
      queryClient.invalidateQueries(['twitter', 'getAccounts'])
    }
  }
}