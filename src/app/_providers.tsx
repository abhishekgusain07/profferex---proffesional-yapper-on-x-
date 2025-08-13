'use client'

import { TRPCProvider } from '@/trpc/client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AccountProvider } from '@/hooks/use-account'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

interface ProvidersProps {
  children: React.ReactNode
  initialSession?: {
    user?: {
      id: string
      email: string
      name?: string
    }
  } | null
}

export function Providers({ children, initialSession }: ProvidersProps) {
  return (
    <NuqsAdapter>
      <TRPCProvider initialSession={initialSession}>
        <AccountProvider>
          {children}
          {/* Only show DevTools in development */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </AccountProvider>
      </TRPCProvider>
    </NuqsAdapter>
  )
}