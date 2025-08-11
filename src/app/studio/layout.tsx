'use client'

import { useState, PropsWithChildren } from 'react'
import { LeftSidebar } from '@/components/left-sidebar'
import { ChatSidebar } from '@/components/chat-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ChatProvider } from '@/hooks/use-chat'
import { AttachmentsProvider } from '@/hooks/use-attachments'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function StudioLayout({ children }: PropsWithChildren) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen)
  }

  const closeChat = () => {
    setIsChatOpen(false)
  }

  return (
    <ChatProvider>
      <AttachmentsProvider>
        <div className="flex h-screen relative">
          {/* Left Navigation Sidebar */}
          <SidebarProvider 
            className="w-fit" 
            defaultOpen={false}
            defaultWidth="16rem"
          >
            <LeftSidebar />
          </SidebarProvider>
          
          {/* Main Content Area */}
          <SidebarInset className="flex-1 relative">
            <div className="w-full h-full">
              {children}
            </div>

            {/* Chat Toggle Button */}
            <div className="absolute top-4 right-4 z-40">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={toggleChat}
                      size="icon"
                      className={`
                        h-12 w-12 rounded-full shadow-lg transition-all duration-200
                        ${isChatOpen 
                          ? 'bg-gray-500 hover:bg-gray-600' 
                          : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
                        }
                      `}
                    >
                      <MessageSquare className="w-5 h-5 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{isChatOpen ? 'Close AI Chat' : 'Open AI Chat'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </SidebarInset>

          {/* Chat Sidebar */}
          <ChatSidebar isOpen={isChatOpen} onClose={closeChat} />
        </div>
      </AttachmentsProvider>
    </ChatProvider>
  )
}