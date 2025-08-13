'use client'

import { ChatProvider } from '@/hooks/use-chat'
import { AttachmentsProvider } from '@/hooks/use-attachments'
import { TweetProvider } from '@/hooks/use-tweets'
import { TwitterDataProvider } from '@/providers/twitter-data-provider'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
  initialTwitterData?: {
    accounts?: any[] | null
    activeAccount?: any | null
  } | null
}

export function DashboardProviders({ children, initialTwitterData }: ProvidersProps) {
  return (
    <TwitterDataProvider initialTwitterData={initialTwitterData}>
      <AttachmentsProvider>
        <TweetProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </TweetProvider>
      </AttachmentsProvider>
    </TwitterDataProvider>
  )
}