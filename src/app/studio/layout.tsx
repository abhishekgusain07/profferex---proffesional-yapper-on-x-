import StudioClientLayout from '@/components/studio-client-layout'
import { cookies } from 'next/headers'
import { PropsWithChildren } from 'react'
import { getServerTwitterAccounts, getServerActiveAccount } from '@/lib/server-twitter'

export default async function Layout({ children }: PropsWithChildren) {
  const cookieStore = await cookies()
  const sidebarWidth = cookieStore.get('sidebar:width')
  const sidebarState = cookieStore.get('sidebar:state')

  // Fetch only critical Twitter data server-side for fast initial load
  const [twitterAccounts, activeAccount] = await Promise.all([
    getServerTwitterAccounts(),
    getServerActiveAccount(),
  ])

  const initialTwitterData = {
    accounts: twitterAccounts,
    activeAccount: activeAccount,
  }

  return (
    <StudioClientLayout 
      width={sidebarWidth} 
      state={sidebarState}
      initialTwitterData={initialTwitterData}
    >
      {children}
    </StudioClientLayout>
  )
}