'use client'

import { ChatProvider } from '@/hooks/use-chat'
import { AttachmentsProvider } from '@/hooks/use-attachments'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function DashboardProviders({ children }: ProvidersProps) {
  return (
    <AttachmentsProvider>
      <ChatProvider>{children}</ChatProvider>
    </AttachmentsProvider>
  )
}