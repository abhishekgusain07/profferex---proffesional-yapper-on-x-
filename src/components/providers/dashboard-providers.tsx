'use client'

import { ChatProvider } from '@/hooks/use-chat'
import { AttachmentsProvider } from '@/hooks/use-attachments'
import { TweetProvider } from '@/hooks/use-tweets'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function DashboardProviders({ children }: ProvidersProps) {
  return (
    <AttachmentsProvider>
      <TweetProvider>
        <ChatProvider>{children}</ChatProvider>
      </TweetProvider>
    </AttachmentsProvider>
  )
}