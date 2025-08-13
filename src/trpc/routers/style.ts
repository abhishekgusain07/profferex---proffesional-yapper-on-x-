import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { redis } from '@/lib/redis'
import { createUserTwitterClient } from '@/lib/twitter'
import { TRPCError } from '@trpc/server'
import { TwitterApi } from 'twitter-api-v2'
import { db } from '@/db'
import { account } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { AccountCache } from '@/lib/account-cache'

type Author = {
  profile_image_url: string
  username: string
  name: string
}

export type Tweet = {
  author: Author
  author_id: string
  created_at: string
  edit_history_tweet_ids: string[]
  id: string
  text: string
}

export type Style = {
  tweets: Tweet[]
  prompt: string | null
  connectedAccount?: {
    username: string
    name: string
    profile_image_url: string
    id: string
    verified: boolean
  }
}

const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!).readOnly

// Helper function to get active account for current user
const getActiveAccount = async (userId: string, userEmail: string) => {
  // Try to get active account ID from cache
  const activeAccountId = await AccountCache.getActiveAccountId(userId)
  
  if (!activeAccountId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Please connect your Twitter account',
    })
  }

  // Get account details from database
  const accountData = await db
    .select()
    .from(account)
    .where(and(
      eq(account.accountId, activeAccountId),
      eq(account.userId, userId),
      eq(account.providerId, 'twitter')
    ))
    .limit(1)
    .then(rows => rows[0] || null)

  if (!accountData) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Please connect your Twitter account',
    })
  }

  return {
    id: activeAccountId,
    dbAccount: accountData
  }
}

export const styleRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx
    
    const activeAccount = await getActiveAccount(user.id, user.email!)
    
    let style: Style | null = null
    
    try {
      style = await redis.json.get<Style>(`style:${user.email}:${activeAccount.id}`)
    } catch (error) {
      console.error('Redis error fetching style:', error)
    }
    
    if (!style) {
      return {
        tweets: [] as Tweet[],
        prompt: null,
      }
    }
    
    return { ...style, tweets: (style.tweets ?? []).reverse() }
  }),

  import: protectedProcedure
    .input(
      z.object({
        link: z.string().min(1).max(200),
        prompt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { link, prompt } = input
      
      const activeAccount = await getActiveAccount(user.id, user.email!)
      
      // Extract tweet ID from Twitter link
      const tweetIdMatch =
        link.match(/twitter\.com\/\w+\/status\/(\d+)/i) ||
        link.match(/x\.com\/\w+\/status\/(\d+)/i)
        
      if (!tweetIdMatch || !tweetIdMatch[1]) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid Twitter link format. Please provide a direct link to a tweet.',
        })
      }
      
      const tweetId = tweetIdMatch[1]
      
      try {
        // Fetch the specific tweet
        const res = await client.v2.tweets(tweetId, {
          'tweet.fields': ['id', 'text', 'created_at', 'author_id', 'note_tweet'],
          'user.fields': ['username', 'profile_image_url', 'name'],
          expansions: ['author_id', 'referenced_tweets.id'],
        })
        
        const [tweet] = res.data
        const includes = res.includes
        
        if (!tweet) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tweet not found',
          })
        }
        
        const author = includes?.users?.find((user) => user.id === tweet.author_id)
        
        const tweetText = tweet.note_tweet?.text ?? tweet.text
        
        // Clean up tweet text by removing image links
        const cleanedTweet = {
          ...tweet,
          text: tweetText.replace(/https:\/\/t\.co\/\w+/g, '').trim(),
          author: author
            ? {
                username: author.username,
                profile_image_url: author.profile_image_url,
                name: author.name,
              }
            : null,
        }
        
        const styleKey = `style:${user.email}:${activeAccount.id}`
        const currentStyle = await redis.json.get<Style>(styleKey)
        
        if (!currentStyle) {
          await redis.json.set(styleKey, '$', {
            tweets: [cleanedTweet],
            prompt: prompt || null,
          })
        } else {
          const currentTweets = currentStyle?.tweets || []
          
          // Check if tweet already exists
          const tweetExists = currentTweets.some(t => t.id === cleanedTweet.id)
          if (tweetExists) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'This tweet has already been imported',
            })
          }
          
          const updatedTweets = [...currentTweets, cleanedTweet]
          
          await redis.json.set(styleKey, '$.tweets', updatedTweets)
          
          if (prompt) {
            await redis.json.set(styleKey, '$.prompt', prompt)
          }
        }
        
        const updatedStyle = await redis.json.get<Style>(styleKey)
        
        return {
          tweets: updatedStyle?.tweets || [],
        }
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Twitter API error:', error)
        
        if (error?.code === 401) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Unable to access tweet. It may be private or deleted.',
          })
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to import tweet. Please try again.',
        })
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        tweetId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { tweetId } = input
      
      const activeAccount = await getActiveAccount(user.id, user.email!)
      
      const styleKey = `style:${user.email}:${activeAccount.id}`
      const styleExists = await redis.exists(styleKey)
      
      if (!styleExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No style found for this user',
        })
      }
      
      const currentStyle = await redis.json.get<Style>(styleKey)
      const currentTweets = currentStyle?.tweets || []
      
      const updatedTweets = currentTweets.filter((tweet) => tweet.id !== tweetId)
      
      await redis.json.set(styleKey, '$.tweets', updatedTweets)
      
      return {
        tweets: updatedTweets,
      }
    }),

  save: protectedProcedure
    .input(
      z.object({
        prompt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx
      const { prompt } = input
      
      const activeAccount = await getActiveAccount(user.id, user.email!)
      
      const styleKey = `style:${user.email}:${activeAccount.id}`
      
      if (typeof prompt !== 'undefined') {
        const exists = await redis.exists(styleKey)
        if (!exists) {
          await redis.json.set(styleKey, '$', { tweets: [], prompt })
        } else {
          await redis.json.merge(styleKey, '$', { prompt })
        }
      }
      
      return {
        success: true,
      }
    }),
})