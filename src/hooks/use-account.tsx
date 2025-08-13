'use client'

import { createContext, useContext } from 'react'
import { trpc } from '@/trpc/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TwitterAccount {
  id: string
  accountId: string
  username: string
  displayName: string
  profileImage: string
  verified: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const AccountContext = createContext<{
  account: TwitterAccount | null
  isLoading: boolean
} | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = trpc.twitter.getActiveAccount.useQuery()

  return (
    <AccountContext.Provider value={{ account: data ?? null, isLoading }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}

export function AccountAvatar({ className }: { className?: string }) {
  const { account, isLoading } = useAccount()
  
  if (isLoading || !account) {
    return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />
  }
  
  return (
    <Avatar className={cn('h-10 w-10 rounded-full', className)}>
      <AvatarImage src={account.profileImage} alt={account.username} />
      <AvatarFallback>
        {(account?.displayName?.[0] || account?.username?.[0] || '?').toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export function AccountName({
  className,
  animate = false,
}: {
  className?: string
  animate?: boolean
}) {
  const { account, isLoading } = useAccount()

  if (isLoading || !account) {
    return <Skeleton className={cn('h-4 w-24 rounded', className)} />
  }

  return (
    <span className={cn('font-semibold inline-flex items-center gap-1', className)}>
      {account.displayName}
      {account.verified && (
        <svg className="size-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
    </span>
  )
}

export function AccountHandle({ className }: { className?: string }) {
  const { account, isLoading } = useAccount()
  
  if (isLoading || !account) {
    return <Skeleton className={cn('h-4 w-16 rounded', className)} />
  }
  
  return <span className={cn('text-stone-400', className)}>@{account.username}</span>
}