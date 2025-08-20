'use client'

import { AccountProvider } from '@/hooks/use-account'
import { AttachmentsProvider } from '@/hooks/use-attachments'
import { ChatProvider } from '@/hooks/use-chat'
import { TweetProvider } from '@/hooks/use-tweets'
import { authClient } from '@/lib/auth-client'
import { ReactNode, useEffect, useRef } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function DashboardProviders({ children }: ProvidersProps) {
  const session = authClient.useSession()
  const isIdentifiedRef = useRef(false)

  // Optional: Add analytics tracking if needed (similar to contentport's posthog)
  useEffect(() => {
    if (isIdentifiedRef.current) return

    if (session.data?.user) {
      // Add analytics tracking here if needed
      console.log('Session started for user:', session.data.user.id)
      isIdentifiedRef.current = true
    }
  }, [session])

  return (
    <AccountProvider>
      <TweetProvider>
        <AttachmentsProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </AttachmentsProvider>
      </TweetProvider>
    </AccountProvider>
  )
}