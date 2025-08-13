import StudioClientLayout from '@/components/studio-client-layout'
import { cookies } from 'next/headers'
import { PropsWithChildren } from 'react'
import { getServerTwitterAccounts, getServerActiveAccount, getServerPostedTweets, getServerScheduledTweets } from '@/lib/server-twitter'

export default async function Layout({ children }: PropsWithChildren) {
  const cookieStore = await cookies()
  const sidebarWidth = cookieStore.get('sidebar:width')
  const sidebarState = cookieStore.get('sidebar:state')

  // Fetch Twitter data server-side for prefetching
  const [twitterAccounts, activeAccount, posted, scheduled] = await Promise.all([
    getServerTwitterAccounts(),
    getServerActiveAccount(),
    getServerPostedTweets({ limit: 20 }),
    getServerScheduledTweets(),
  ])

  const initialTwitterData = {
    accounts: twitterAccounts,
    activeAccount: activeAccount,
    posted,
    scheduled,
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