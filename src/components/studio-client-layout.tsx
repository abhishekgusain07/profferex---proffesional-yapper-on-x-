'use client'

import { PropsWithChildren } from 'react'
import { LeftSidebar } from '@/components/left-sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { AppSidebarInset } from '@/components/providers/app-sidebar-inset'
import { DashboardProviders } from '@/components/providers/dashboard-providers'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useCmdL } from '@/hooks/use-keyboard-shortcut'

interface LayoutProps extends PropsWithChildren {
  hideAppSidebar?: boolean
  width: any
  state: any
  // Enhanced layout options for contentport-style dual sidebars
  leftSidebarCollapsed?: boolean
  rightSidebarWidth?: string
  enableResponsiveLayout?: boolean
}

const initialConfig = {
  namespace: 'chat-input',
  theme: {
    text: {
      bold: 'font-bold',
      italic: 'italic',
      underline: 'underline',
    },
    paragraph: 'text-gray-900 leading-relaxed',
  },
  onError: (error: Error) => {
    console.error('[Chat Editor Error]', error)
  },
  nodes: [],
}

// Component that adds keyboard shortcut to toggle the right sidebar (Assistant chat)
function RightSidebarKeyboardShortcut({ children }: { children: React.ReactNode }) {
  const { toggleSidebar } = useSidebar()

  // Register Cmd+L (Mac) / Ctrl+L (Windows/Linux) shortcut to toggle right sidebar
  useCmdL(() => {
    toggleSidebar()
  })

  return <>{children}</>
}

export default function StudioClientLayout({
  children,
  width,
  state,
  hideAppSidebar,
  leftSidebarCollapsed = false,
  rightSidebarWidth,
  enableResponsiveLayout = true,
}: LayoutProps) {
  let defaultOpen = true

  if (state) {
    defaultOpen = state && state.value === 'true'
  }

  const finalWidth = rightSidebarWidth || width?.value || '28rem'

  return (
    <DashboardProviders>
      {/* Enhanced contentport-style layout with proper sidebar management */}
      <div className="flex min-h-screen bg-gray-50/30">
        {/* Left Sidebar - Navigation */}
        <SidebarProvider 
          className="w-fit border-r border-gray-200 bg-white shadow-sm" 
          defaultOpen={!leftSidebarCollapsed}
        >
          <LeftSidebar />
        </SidebarProvider>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Content */}
          <div className="flex-1 min-w-0">
            {hideAppSidebar ? (
              <div className="h-full">
                {children}
              </div>
            ) : (
              <SidebarProvider 
                defaultOpen={defaultOpen} 
                defaultWidth={finalWidth}
                className="h-full"
              >
                <RightSidebarKeyboardShortcut>
                  <LexicalComposer initialConfig={initialConfig}>
                    <AppSidebar>
                      <AppSidebarInset className="bg-white">
                        {children}
                      </AppSidebarInset>
                    </AppSidebar>
                  </LexicalComposer>
                </RightSidebarKeyboardShortcut>
              </SidebarProvider>
            )}
          </div>
        </div>
      </div>
    </DashboardProviders>
  )
}