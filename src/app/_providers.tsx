'use client'

import { TRPCProvider } from '@/trpc/client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AccountProvider } from '@/hooks/use-account'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Toaster } from 'react-hot-toast'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NuqsAdapter>
      <TRPCProvider>
        <AccountProvider>
          {children}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
          {/* Only show DevTools in development */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </AccountProvider>
      </TRPCProvider>
    </NuqsAdapter>
  )
}