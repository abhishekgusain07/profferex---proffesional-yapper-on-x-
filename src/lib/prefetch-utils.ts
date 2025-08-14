'use client'

import { useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { useSession } from '@/lib/auth-client'
import { ENABLE_TWITTER_ANALYTICS } from '@/constants/feature-flags'

// Prefetch common data on router navigation
export function usePrefetchOnHover() {
  const utils = trpc.useUtils()
  const { data: session } = useSession()

  const prefetchPostedTweets = () => {
    if (!ENABLE_TWITTER_ANALYTICS) {
      console.debug('Posted tweets prefetch skipped: analytics disabled')
      return
    }
    if (!session) {
      console.debug('Posted tweets prefetch skipped: no session')
      return
    }
    
    try {
      console.debug('Prefetching posted tweets...')
      utils.twitter.getPosted.prefetchInfinite(
        { limit: 20 },
        {
          staleTime: 5 * 60 * 1000, // 5 minutes
        }
      )
    } catch (error) {
      console.warn('Failed to prefetch posted tweets:', error)
    }
  }

  const prefetchScheduledTweets = () => {
    if (!session) {
      console.debug('Scheduled tweets prefetch skipped: no session')
      return
    }
    
    try {
      console.debug('Prefetching scheduled tweets...')
      utils.twitter.getScheduled.prefetch(undefined, {
        staleTime: 30 * 1000, // 30 seconds
      })
    } catch (error) {
      console.warn('Failed to prefetch scheduled tweets:', error)
    }
  }

  const prefetchTwitterAccounts = () => {
    if (!session) {
      console.debug('Twitter accounts prefetch skipped: no session')
      return
    }
    
    try {
      console.debug('Prefetching Twitter accounts...')
      utils.twitter.getAccounts.prefetch(undefined, {
        staleTime: 5 * 60 * 1000, // 5 minutes
      })
    } catch (error) {
      console.warn('Failed to prefetch Twitter accounts:', error)
    }
  }

  return {
    prefetchPostedTweets,
    prefetchScheduledTweets,
    prefetchTwitterAccounts,
  }
}

// Background data refresh utilities
export function useBackgroundRefresh() {
  const utils = trpc.useUtils()
  const { data: session } = useSession()

  // Refresh stale data in background
  useEffect(() => {
    if (!session) return

    const interval = setInterval(() => {
      // Only refresh if user is active (has focus)
      if (!document.hidden) {
        console.debug('Background refresh: invalidating stale queries')
        utils.invalidate(undefined, {
          predicate: (query) => query.isStale(),
        })
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [utils, session])

  // Refresh on page visibility change
  useEffect(() => {
    if (!session) return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.debug('Visibility change: refreshing critical data')
        // User came back to tab, refresh critical data
        utils.twitter.getActiveAccount.invalidate()
        utils.twitter.getScheduled.invalidate()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [utils, session])
}

// Smart cache warming for navigation
export function warmNavCache() {
  const utils = trpc.useUtils()
  const { data: session } = useSession()
  
  // Warm cache for likely next pages
  const warmCache = () => {
    if (!session) {
      console.debug('Cache warming skipped: no session')
      return
    }

    try {
      const pathname = window.location.pathname
      console.debug(`Cache warming for pathname: ${pathname}`)
      
      // If user is on studio, warm posted/scheduled cache
      if (pathname === '/studio') {
        if (ENABLE_TWITTER_ANALYTICS) {
          console.debug('Warming posted tweets cache from studio')
          utils.twitter.getPosted.prefetchInfinite(
            { limit: 20 },
            { staleTime: 5 * 60 * 1000 }
          )
        }
        console.debug('Warming scheduled tweets cache from studio')
        utils.twitter.getScheduled.prefetch(undefined, {
          staleTime: 30 * 1000
        })
      }
      
      // If user is on posted, warm scheduled cache
      if (pathname.includes('/posted')) {
        console.debug('Warming scheduled tweets cache from posted')
        utils.twitter.getScheduled.prefetch(undefined, {
          staleTime: 30 * 1000
        })
      }
      
      // If user is on scheduled, warm posted cache
      if (pathname.includes('/scheduled')) {
        if (ENABLE_TWITTER_ANALYTICS) {
          console.debug('Warming posted tweets cache from scheduled')
          utils.twitter.getPosted.prefetchInfinite(
            { limit: 20 },
            { staleTime: 5 * 60 * 1000 }
          )
        }
      }
    } catch (error) {
      console.warn('Failed to warm cache:', error)
    }
  }

  // Warm on page load
  useEffect(() => {
    if (!session) return
    
    const timer = setTimeout(warmCache, 1000) // 1 second delay
    return () => clearTimeout(timer)
  }, [session]) // Re-run when session changes
}