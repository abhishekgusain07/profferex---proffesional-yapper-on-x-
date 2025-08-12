'use client'

import { PropsWithChildren } from 'react'
import { LeftSidebar } from '@/components/left-sidebar'
import { AppSidebarInset } from '@/components/providers/app-sidebar-inset'
import { DashboardProviders } from '@/components/providers/dashboard-providers'
import { SidebarProvider } from '@/components/ui/sidebar'

interface LayoutProps extends PropsWithChildren {
  hideAppSidebar?: boolean
  width: any
  state: any
}

export default function StudioClientLayout({
  children,
  width,
  state,
  hideAppSidebar,
}: LayoutProps) {
  let defaultOpen = true

  if (state) {
    defaultOpen = state && state.value === 'true'
  }

  return (
    <DashboardProviders>
      <div className="flex">
        <SidebarProvider className="w-fit" defaultOpen={false}>
          <LeftSidebar />
        </SidebarProvider>

        <SidebarProvider defaultOpen={defaultOpen} defaultWidth={width?.value || '32rem'}>
          {hideAppSidebar ? (
            <AppSidebarInset>{children}</AppSidebarInset>
          ) : (
            <AppSidebarInset>{children}</AppSidebarInset>
          )}
        </SidebarProvider>
      </div>
    </DashboardProviders>
  )
}