'use client'

import { ChatProvider, useChatContext } from '@/hooks/use-chat'
import { AttachmentsProvider } from '@/hooks/use-attachments'
import { TweetProvider } from '@/hooks/use-tweets'
import { useCmdL } from '@/hooks/use-keyboard-shortcut'
import { ChatSidebar } from '@/components/chat-sidebar'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

// Inner component that uses chat context and keyboard shortcut
function KeyboardShortcutProvider({ children }: { children: ReactNode }) {
  const { toggleChatSidebar, chatSidebarOpen, setChatSidebarOpen } = useChatContext()

  // Register Cmd+L (Mac) / Ctrl+L (Windows/Linux) shortcut
  useCmdL(() => {
    toggleChatSidebar()
  })

  return (
    <>
      {children}
      <ChatSidebar 
        isOpen={chatSidebarOpen} 
        onClose={() => setChatSidebarOpen(false)} 
      />
    </>
  )
}

export function DashboardProviders({ children }: ProvidersProps) {
  return (
    <AttachmentsProvider>
      <TweetProvider>
        <ChatProvider>
          <KeyboardShortcutProvider>
            {children}
          </KeyboardShortcutProvider>
        </ChatProvider>
      </TweetProvider>
    </AttachmentsProvider>
  )
}