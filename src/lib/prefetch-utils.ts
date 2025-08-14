'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

// Prefetch common data on router navigation
export function usePrefetchOnHover() {
  const queryClient = useQueryClient()

  const prefetchPostedTweets = () => {
    try {
      queryClient.prefetchInfiniteQuery({
        queryKey: ['twitter', 'getPosted', { limit: 20 }],
        staleTime: 5 * 60 * 1000, // 5 minutes
      })
    } catch (error) {
      console.warn('Failed to prefetch posted tweets:', error)
    }
  }

  const prefetchScheduledTweets = () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['twitter', 'getScheduled'],
        staleTime: 30 * 1000, // 30 seconds
      })
    } catch (error) {
      console.warn('Failed to prefetch scheduled tweets:', error)
    }
  }

  const prefetchTwitterAccounts = () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['twitter', 'getAccounts'],
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
  const queryClient = useQueryClient()

  // Refresh stale data in background
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if user is active (has focus)
      if (!document.hidden) {
        queryClient.invalidateQueries({
          stale: true,
          refetchType: 'inactive'
        })
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [queryClient])

  // Refresh on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User came back to tab, refresh critical data
        queryClient.invalidateQueries(['twitter', 'getActiveAccount'])
        queryClient.invalidateQueries(['twitter', 'getScheduled'])
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [queryClient])
}

// Smart cache warming for navigation
export function warmNavCache() {
  const queryClient = useQueryClient()
  
  // Warm cache for likely next pages
  const warmCache = () => {
    // If user is on studio, warm posted/scheduled cache
    if (window.location.pathname === '/studio') {
      queryClient.prefetchInfiniteQuery(['twitter', 'getPosted', { limit: 20 }])
      queryClient.prefetchQuery(['twitter', 'getScheduled'])
    }
    
    // If user is on posted, warm scheduled cache
    if (window.location.pathname.includes('/posted')) {
      queryClient.prefetchQuery(['twitter', 'getScheduled'])
    }
    
    // If user is on scheduled, warm posted cache
    if (window.location.pathname.includes('/scheduled')) {
      queryClient.prefetchInfiniteQuery(['twitter', 'getPosted', { limit: 20 }])
    }
  }

  // Warm on page load
  useEffect(() => {
    const timer = setTimeout(warmCache, 1000) // 1 second delay
    return () => clearTimeout(timer)
  }, [])
}