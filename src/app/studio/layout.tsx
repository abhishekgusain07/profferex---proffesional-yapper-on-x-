import StudioClientLayout from '@/components/studio-client-layout'
import { cookies } from 'next/headers'
import { PropsWithChildren } from 'react'
import { getServerTwitterAccounts, getServerActiveAccount, getServerPostedTweets, getServerScheduledTweets } from '@/lib/server-twitter'
import { ENABLE_TWITTER_ANALYTICS } from '@/constants/feature-flags'

export default async function Layout({ children }: PropsWithChildren) {
  const cookieStore = await cookies()
  const sidebarWidth = cookieStore.get('sidebar:width')
  const sidebarState = cookieStore.get('sidebar:state')

  // Fetch Twitter data server-side for prefetching
  const [twitterAccounts, activeAccount, posted, scheduled] = await Promise.all([
    getServerTwitterAccounts(),
    getServerActiveAccount(),
    // Only prefetch posted when analytics are enabled; otherwise skip to avoid API use
    ENABLE_TWITTER_ANALYTICS ? getServerPostedTweets({ limit: 20 }) : Promise.resolve(null),
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