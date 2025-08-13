import { appRouter } from '@/trpc/routers/_app'
import { createCallerFactory, createTRPCContext } from '@/trpc/init'
import { headers } from 'next/headers'
import 'server-only'

const createCaller = createCallerFactory(appRouter)

export async function getServerTwitterAccounts() {
  try {
    const context = await createTRPCContext()
    if (!context.user) {
      return null
    }

    const caller = createCaller(context)
    const accounts = await caller.twitter.getAccounts()
    return accounts
  } catch (error) {
    console.error('Error getting server Twitter accounts:', error)
    return null
  }
}

export async function getServerActiveAccount() {
  try {
    const context = await createTRPCContext()
    if (!context.user) {
      return null
    }

    const caller = createCaller(context)
    const activeAccount = await caller.twitter.getActiveAccount()
    return activeAccount
  } catch (error) {
    console.error('Error getting server active account:', error)
    return null
  }
}

export async function getServerScheduledTweets() {
  try {
    const context = await createTRPCContext()
    if (!context.user) {
      return null
    }

    const caller = createCaller(context)
    const scheduledTweets = await caller.twitter.getScheduled()
    return scheduledTweets
  } catch (error) {
    console.error('Error getting server scheduled tweets:', error)
    return null
  }
}

export async function getServerPostedTweets(params = { limit: 20 }) {
  try {
    const context = await createTRPCContext()
    if (!context.user) {
      return null
    }

    const caller = createCaller(context)
    const postedTweets = await caller.twitter.getPosted(params)
    return postedTweets
  } catch (error) {
    console.error('Error getting server posted tweets:', error)
    return null
  }
}