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
  initialTwitterData?: {
    accounts?: any[] | null
    activeAccount?: any | null
  } | null
}

const initialConfig = {
  namespace: 'chat-input',
  theme: {
    text: {
      bold: 'font-bold',
      italic: 'italic',
      underline: 'underline',
    },
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
  initialTwitterData,
}: LayoutProps) {
  let defaultOpen = true

  if (state) {
    defaultOpen = state && state.value === 'true'
  }

  return (
    <DashboardProviders initialTwitterData={initialTwitterData}>
      <div className="flex">
        <SidebarProvider className="w-fit" defaultOpen={false}>
          <LeftSidebar />
        </SidebarProvider>

        <SidebarProvider defaultOpen={defaultOpen} defaultWidth={width?.value || '32rem'}>
          <RightSidebarKeyboardShortcut>
            {hideAppSidebar ? (
              <AppSidebarInset>{children}</AppSidebarInset>
            ) : (
              <LexicalComposer initialConfig={initialConfig}>
                <AppSidebar>
                  <AppSidebarInset>{children}</AppSidebarInset>
                </AppSidebar>
              </LexicalComposer>
            )}
          </RightSidebarKeyboardShortcut>
        </SidebarProvider>
      </div>
    </DashboardProviders>
  )
}