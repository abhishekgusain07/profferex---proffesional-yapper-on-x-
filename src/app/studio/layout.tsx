'use client'

import { PropsWithChildren } from 'react'
import { LeftSidebar } from '@/components/left-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export default function StudioLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex h-screen">
      {/* Left Navigation Sidebar */}
      <SidebarProvider 
        className="w-fit" 
        defaultOpen={false}
        defaultWidth="16rem"
      >
        <LeftSidebar />
      </SidebarProvider>
      
      {/* Main Content Area */}
      <SidebarInset className="flex-1">
        <div className="w-full h-full">
          {children}
        </div>
      </SidebarInset>
    </div>
  )
}