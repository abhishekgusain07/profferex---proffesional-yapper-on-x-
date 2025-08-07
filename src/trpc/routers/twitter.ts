import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { redis } from '@/lib/redis'
import { twitterOAuthClient, createUserTwitterClient } from '@/lib/twitter'
import { getBaseUrl } from '@/constants/base-url'
import { db } from '@/db'
import { account } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export const twitterRouter = createTRPCRouter({
  createLink: protectedProcedure
    .input(z.object({ action: z.enum(['add-account']).default('add-account') }).optional())
    .query(async ({ ctx, input }) => {
      if (!process.env.TWITTER_CONSUMER_KEY || !process.env.TWITTER_CONSUMER_SECRET) {
        throw new Error('Twitter app keys not configured')
      }

      const callbackUrl = `${getBaseUrl()}/api/twitter/callback`
      try {
        const { url, oauth_token, oauth_token_secret } = await twitterOAuthClient.generateAuthLink(callbackUrl)

        // Keep short TTL to limit replay; 10 minutes
        const ex = 10 * 60
        await Promise.all([
          redis.set(`twitter_oauth_secret:${oauth_token}`, oauth_token_secret, { ex }),
          redis.set(`twitter_oauth_user_id:${oauth_token}`, ctx.user.id, { ex }),
          redis.set(`auth_action:${oauth_token}`, (input?.action ?? 'add-account') as string, { ex }),
        ])

        return { url }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to create Twitter link', err)
        throw new Error('Failed to create Twitter link')
      }
    }),

  getAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      const results = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      return results.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      }))
    }),

  postNow: protectedProcedure
    .input(z.object({
      text: z.string().min(1, 'Tweet cannot be empty').max(280, 'Tweet exceeds 280 characters'),
      accountId: z.string().optional(), // if omitted, use the first connected
    }))
    .mutation(async ({ ctx, input }) => {
      const accounts = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!accounts.length) {
        throw new Error('No connected Twitter accounts')
      }

      const target = input.accountId
        ? accounts.find((a) => a.id === input.accountId)
        : accounts[0]

      if (!target) {
        throw new Error('Selected account not found')
      }

      if (!target.accessToken || !target.accessSecret) {
        throw new Error('Account is missing credentials')
      }

      const client = createUserTwitterClient(target.accessToken, target.accessSecret)

      try {
        const result = await client.v2.tweet(input.text)
        return { success: true, tweetId: result.data.id }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('Tweet failed', e)
        const message = e?.data?.detail || e?.message || 'Failed to post tweet'
        throw new Error(message)
      }
    }),
}) 