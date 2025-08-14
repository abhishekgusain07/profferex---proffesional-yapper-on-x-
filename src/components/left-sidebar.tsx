'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSession, signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { ArrowLeftFromLine, ArrowRightFromLine, PanelLeft, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePrefetchOnHover } from '@/lib/prefetch-utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  useSidebar,
} from './ui/sidebar'

export const LeftSidebar = () => {
  const { state } = useSidebar()
  const { data: session } = useSession()
  const pathname = usePathname()
  const isCollapsed = state === 'collapsed'
  const { toggleSidebar } = useSidebar()
  const { prefetchPostedTweets, prefetchScheduledTweets } = usePrefetchOnHover()

  return (
    <Sidebar collapsible="icon" side="left" className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 p-4">
        <div className="flex items-center justify-start gap-2">
          <button
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-center group/toggle-button flex-shrink-0"
          >
            <PanelLeft className="h-4 w-4 transition-all duration-200 group-hover/toggle-button:opacity-0 group-hover/toggle-button:scale-75" />
            <div className="absolute transition-all duration-200 opacity-0 scale-75 group-hover/toggle-button:opacity-100 group-hover/toggle-button:scale-100">
              {isCollapsed ? (
                <ArrowRightFromLine className="h-4 w-4" />
              ) : (
                <ArrowLeftFromLine className="h-4 w-4" />
              )}
            </div>
          </button>
          <div
            className={cn(
              'flex items-center gap-2 transition-all duration-200 ease-out',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            )}
          >
            <Link href="/">
            <div className='flex items-center justify-center gap-0.5'>
            <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-md flex items-center justify-center text-white text-sm font-bold">
              T
            </div>
            <p className={cn('text-sm/6 text-slate-800 font-semibold')}>Twitter Studio</p>
            </div>
            </Link>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Create Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              'transition-all duration-200 ease-out px-3',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            )}
          >
            Create
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Link
              href="/studio"
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  className: 'w-full justify-start gap-2 px-3 py-2',
                }),
                pathname === '/studio' &&
                  'bg-blue-100 hover:bg-blue-100 text-blue-900 border border-blue-200',
              )}
            >
              <div className="size-6 flex items-center justify-center flex-shrink-0">
                ✏️
              </div>
              <span
                className={cn(
                  'transition-all opacity-0 duration-200 ease-out delay-200',
                  isCollapsed ? 'opacity-0 w-0 overflow-hidden hidden' : 'opacity-100',
                )}
              >
                Studio
              </span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Manage Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              'transition-all duration-200 ease-out px-3',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            )}
          >
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-1">
              <Link
                href="/studio/scheduled"
                onMouseEnter={prefetchScheduledTweets}
                className={cn(
                  buttonVariants({
                    variant: 'ghost',
                    className: 'justify-start gap-2 px-3 py-2',
                  }),
                  pathname === '/studio/scheduled' &&
                    'bg-blue-100 hover:bg-blue-100 text-blue-900 border border-blue-200',
                )}
              >
                <div className="size-6 flex items-center justify-center flex-shrink-0">
                  📅
                </div>
                <span
                  className={cn(
                    'transition-all duration-200 ease-out',
                    isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
                  )}
                >
                  Scheduled
                </span>
              </Link>

              <Link
                href="/studio/posted"
                onMouseEnter={prefetchPostedTweets}
                className={cn(
                  buttonVariants({
                    variant: 'ghost',
                    className: 'justify-start gap-2 px-3 py-2',
                  }),
                  pathname === '/studio/posted' &&
                    'bg-blue-100 hover:bg-blue-100 text-blue-900 border border-blue-200',
                )}
              >
                <div className="size-6 flex items-center justify-center flex-shrink-0">
                  📤
                </div>
                <span
                  className={cn(
                    'transition-all duration-200 ease-out',
                    isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
                  )}
                >
                  Posted
                </span>
              </Link>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Knowledge Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              'transition-all duration-200 ease-out px-3',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            )}
          >
            Knowledge
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Link
              href="/studio/knowledge"
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  className: 'w-full justify-start gap-2 px-3 py-2',
                }),
                pathname.includes('/studio/knowledge') &&
                  'bg-blue-100 hover:bg-blue-100 text-blue-900 border border-blue-200',
              )}
            >
              <div className="size-6 flex items-center justify-center flex-shrink-0">
                🧠
              </div>
              <span
                className={cn(
                  'transition-all duration-200 ease-out',
                  isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
                )}
              >
                Knowledge
              </span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              'transition-all duration-200 ease-out px-3',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            )}
          >
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Link
              href="/studio/accounts"
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  className: 'w-full justify-start gap-2 px-3 py-2',
                }),
                pathname.includes('/studio/accounts') &&
                  'bg-blue-100 hover:bg-blue-100 text-blue-900 border border-blue-200',
              )}
            >
              <div className="size-6 flex items-center justify-center flex-shrink-0">
                👤
              </div>
              <span
                className={cn(
                  'transition-all duration-200 ease-out',
                  isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
                )}
              >
                Accounts
              </span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-4">
        <div
          className={cn(
            'transition-all duration-200 ease-out overflow-hidden',
            isCollapsed ? 'opacity-0 max-h-0' : 'opacity-100 max-h-[1000px]',
          )}
        >
          <div className="flex flex-col gap-2">
            {session?.user ? (
              <Link
                href="/studio/settings"
                className={cn(
                  buttonVariants({
                    variant: 'outline',
                    className: 'flex items-center gap-3 justify-start px-3 py-2 h-auto',
                  }),
                )}
              >
                <Avatar className="size-8 border border-gray-200 shadow-sm">
                  <AvatarImage
                    src={session.user.image || undefined}
                    alt={session.user.name ?? 'Profile'}
                  />
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                    {session.user.name?.charAt(0) ?? session.user.email?.charAt(0) ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 text-left">
                  <span className="truncate text-sm font-medium text-slate-800">
                    {session.user.name ?? session.user.email ?? 'Account'}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    Settings & Profile
                  </span>
                </div>
              </Link>
            ) : (
              <Button
                variant="outline"
                className="flex items-center gap-3 justify-start px-3 py-2 h-auto"
              >
                <div className="size-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Settings className="size-4 text-gray-500" />
                </div>
                <div className="flex flex-col items-start min-w-0 text-left">
                  <span className="truncate text-sm font-medium text-slate-800">
                    Not logged in
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    Sign in to continue
                  </span>
                </div>
              </Button>
            )}
          </div>
        </div>

        {/* Collapsed state - just settings icon */}
        <div
          className={cn(
            'transition-all duration-0 ease-out overflow-hidden',
            isCollapsed ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0',
          )}
        >
          <div className="flex flex-col gap-2">
            <Link
              href="/studio/settings"
              className={buttonVariants({
                variant: 'ghost',
                className: 'text-muted-foreground hover:text-foreground',
              })}
            >
              <Settings className="size-5" />
            </Link>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}