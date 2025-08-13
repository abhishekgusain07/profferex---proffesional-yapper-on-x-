'use client'

import { TRPCProvider } from '@/trpc/client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AccountProvider } from '@/hooks/use-account'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <AccountProvider>
        {children}
        {/* Only show DevTools in development */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </AccountProvider>
    </TRPCProvider>
  )
}