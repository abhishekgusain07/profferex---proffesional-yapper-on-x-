import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { redis } from '@/lib/redis'
import { twitterOAuthClient, createUserTwitterClient } from '@/lib/twitter'
import { getBaseUrl } from '@/constants/base-url'
import { db } from '@/db'
import { account, tweets } from '@/db/schema'
import { and, eq, desc, gte, lte, lt, ilike, inArray } from 'drizzle-orm'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { qstash } from '@/lib/qstash'
import { AccountCache, CachedAccountData } from '@/lib/account-cache'
import { fetchTweetAnalytics } from '@/lib/twitter-analytics'
import { ENABLE_TWITTER_ANALYTICS } from '@/constants/feature-flags'

export const twitterRouter = createTRPCRouter({
  createLink: protectedProcedure
    .input(z.object({ action: z.enum(['add-account']).default('add-account') }).optional())
    .query(async ({ ctx, input }) => {
      if (!process.env.TWITTER_CONSUMER_KEY || !process.env.TWITTER_CONSUMER_SECRET) {
        console.error('Twitter credentials missing:', {
          hasConsumerKey: !!process.env.TWITTER_CONSUMER_KEY,
          hasConsumerSecret: !!process.env.TWITTER_CONSUMER_SECRET,
        })
        throw new Error('Twitter app credentials are not configured. Please check your environment variables.')
      }

      const callbackUrl = `${getBaseUrl()}/api/twitter/callback`
      console.log('🔗 Creating Twitter OAuth link:', {
        callbackUrl,
        userId: ctx.user.id,
        action: input?.action ?? 'add-account',
      })

      try {
        const { url, oauth_token, oauth_token_secret } = await twitterOAuthClient.generateAuthLink(callbackUrl)

        // Keep short TTL to limit replay; 10 minutes
        const ex = 10 * 60
        await Promise.all([
          redis.set(`twitter_oauth_secret:${oauth_token}`, oauth_token_secret, { ex }),
          redis.set(`twitter_oauth_user_id:${oauth_token}`, ctx.user.id, { ex }),
          redis.set(`auth_action:${oauth_token}`, (input?.action ?? 'add-account') as string, { ex }),
        ])

        console.log('✅ Twitter OAuth link created successfully:', {
          hasUrl: !!url,
          hasToken: !!oauth_token,
        })

        return { url }
      } catch (err: any) {
        console.error('❌ Twitter OAuth error details:', {
          error: err.message,
          code: err.code,
          data: err.data,
          type: err.type,
          headers: err.headers,
          rateLimitReset: err.rateLimit?.reset,
          callbackUrl,
        })

        // Provide more specific error messages based on the error
        if (err.code === 403) {
          throw new Error('Twitter app authentication failed. Please verify your Twitter app credentials and permissions are correctly configured.')
        } else if (err.code === 401) {
          throw new Error('Twitter app credentials are invalid. Please check your API key and secret.')
        } else if (err.code === 429) {
          throw new Error('Rate limit exceeded. Please try again later.')
        } else {
          throw new Error(`Twitter API error (${err.code || 'unknown'}): ${err.message || 'Failed to create authentication link'}`)
        }
      }
    }),

  getAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      console.log('📋 Fetching accounts for user:', ctx.user.id)
      
      // Try to get accounts from cache first
      const cachedAccounts = await AccountCache.getUserAccounts(ctx.user.id)
      const activeAccountId = await AccountCache.getActiveAccountId(ctx.user.id)
      
      console.log('📋 Cache results:', {
        cachedAccountsCount: cachedAccounts.length,
        activeAccountId,
        cachedAccountIds: cachedAccounts.map(a => ({ id: a.accountId, username: a.username }))
      })

      if (cachedAccounts.length > 0) {
        // Return cached data with active account marked
        const mappedAccounts = cachedAccounts.map(account => ({
          ...account,
          isActive: account.accountId === activeAccountId,
        }))
        
        console.log('📋 Mapped accounts with active status:', 
          mappedAccounts.map(a => ({ 
            accountId: a.accountId, 
            username: a.username, 
            isActive: a.isActive 
          }))
        )
        
        return mappedAccounts
      }

      // Fallback to database if cache is empty
      const results = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (results.length === 0) {
        return []
      }

      // Try to fetch profile data from Twitter API for each account and cache it
      const enrichedAccounts: CachedAccountData[] = []
      
      for (const dbAccount of results) {
        // Skip accounts without valid accountId
        if (!dbAccount.accountId || typeof dbAccount.accountId !== 'string') {
          console.warn('⚠️ Skipping account with invalid accountId:', {
            accountId: dbAccount.accountId,
            id: dbAccount.id,
            type: typeof dbAccount.accountId,
          })
          continue
        }

        const profileData = {
          username: '',
          displayName: '',
          profileImage: '',
          verified: false,
        }

        // Attempt to fetch current profile data from Twitter
        try {
          if (dbAccount.accessToken && dbAccount.accessSecret) {
            const client = createUserTwitterClient(dbAccount.accessToken, dbAccount.accessSecret)
            const me = await client.currentUser()
            profileData.username = me.screen_name || ''
            profileData.displayName = me.name || me.screen_name || ''
            // @ts-expect-error - v1 typings
            profileData.profileImage = me.profile_image_url_https || ''
            // @ts-expect-error - v1 typings
            profileData.verified = me.verified || false
          }
        } catch {
          // If Twitter API fails, use fallback data
          profileData.username = `user_${dbAccount.accountId}`
          profileData.displayName = profileData.username
        }

        const enrichedAccount: CachedAccountData = {
          id: dbAccount.id,
          accountId: dbAccount.accountId,
          username: profileData.username,
          displayName: profileData.displayName,
          profileImage: profileData.profileImage,
          verified: profileData.verified,
          isActive: dbAccount.accountId === activeAccountId,
          createdAt: dbAccount.createdAt,
          updatedAt: dbAccount.updatedAt,
        }

        enrichedAccounts.push(enrichedAccount)

        // Cache the enriched data for future requests
        await AccountCache.cacheAccount(ctx.user.id, enrichedAccount)
      }

      return enrichedAccounts
    }),

  setActiveAccount: protectedProcedure
    .input(z.object({
      accountId: z.string().min(1, 'Account ID is required').regex(/^[0-9]+$/, 'Account ID must be a numeric string'),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('🔄 Setting active account:', {
        userId: ctx.user.id,
        requestedAccountId: input.accountId,
        accountIdType: typeof input.accountId,
        accountIdLength: input.accountId?.length,
        accountIdValue: input.accountId,
      })

      // Verify the account exists and belongs to the current user
      const accountExists = await db
        .select({ id: account.id, accountId: account.accountId })
        .from(account)
        .where(and(
          eq(account.accountId, input.accountId),
          eq(account.userId, ctx.user.id),
          eq(account.providerId, 'twitter')
        ))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!accountExists) {
        console.error('❌ Account not found:', {
          requestedAccountId: input.accountId,
          userId: ctx.user.id,
        })
        throw new Error('Account not found or you do not have permission to access it')
      }

      console.log('✅ Account verified:', accountExists)

      // Set as active account in cache
      await AccountCache.setActiveAccount(ctx.user.id, input.accountId)

      // Verify the active account was set correctly
      const verifyActiveAccount = await AccountCache.getActiveAccountId(ctx.user.id)
      console.log('✅ Active account set and verified:', {
        setAccountId: input.accountId,
        retrievedActiveId: verifyActiveAccount,
        matches: verifyActiveAccount === input.accountId,
      })

      return {
        success: true,
        activeAccountId: input.accountId,
      }
    }),

  getActiveAccount: protectedProcedure
    .query(async ({ ctx }) => {
      const activeAccountId = await AccountCache.getActiveAccountId(ctx.user.id)
      
      if (!activeAccountId) {
        return null
      }

      // Get the active account details from cache
      const activeAccount = await AccountCache.getAccount(ctx.user.id, activeAccountId)
      
      if (!activeAccount) {
        // If not in cache, try to get from database and cache it
        const dbAccount = await db
          .select()
          .from(account)
          .where(and(
            eq(account.accountId, activeAccountId),
            eq(account.userId, ctx.user.id),
            eq(account.providerId, 'twitter')
          ))
          .limit(1)
          .then(rows => rows[0] || null)

        if (!dbAccount) {
          // Active account no longer exists, clear it
          await AccountCache.setActiveAccount(ctx.user.id, '')
          return null
        }

        // Try to fetch fresh profile data and cache it
        const profileData = {
          username: `user_${dbAccount.accountId}`,
          displayName: `user_${dbAccount.accountId}`,
          profileImage: '',
          verified: false,
        }

        try {
          if (dbAccount.accessToken && dbAccount.accessSecret) {
            const client = createUserTwitterClient(dbAccount.accessToken, dbAccount.accessSecret)
            const me = await client.currentUser()
            profileData.username = me.screen_name || profileData.username
            profileData.displayName = me.name || me.screen_name || profileData.displayName
            // @ts-expect-error - v1 typings
            profileData.profileImage = me.profile_image_url_https || ''
            // @ts-expect-error - v1 typings
            profileData.verified = me.verified || false
          }
        } catch {
          // Use fallback data if API fails
        }

        const enrichedAccount = {
          id: dbAccount.id,
          accountId: dbAccount.accountId,
          username: profileData.username,
          displayName: profileData.displayName,
          profileImage: profileData.profileImage,
          verified: profileData.verified,
          isActive: true,
          createdAt: dbAccount.createdAt,
          updatedAt: dbAccount.updatedAt,
        }

        await AccountCache.cacheAccount(ctx.user.id, enrichedAccount)
        return enrichedAccount
      }

      return {
        ...activeAccount,
        isActive: true,
      }
    }),

  uploadMediaFromR2: protectedProcedure
    .input(z.object({ r2Key: z.string().min(1), mediaType: z.literal('image') }))
    .mutation(async ({ ctx, input }) => {
      if (!R2_BUCKET_NAME) throw new Error('R2 bucket not configured')

      const accounts = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!accounts.length) throw new Error('No connected Twitter accounts')
      const target = accounts[0]
      if (!target.accessToken || !target.accessSecret) throw new Error('Account missing credentials')

      console.log(`🔍 [TWITTER-MEDIA] ========== STARTING MEDIA UPLOAD DEBUG ==========`)
      console.log(`🔍 [TWITTER-MEDIA] Input mediaType: "${input.mediaType}"`)
      console.log(`🔍 [TWITTER-MEDIA] Input r2Key: "${input.r2Key}"`)
      console.log(`🔍 [TWITTER-MEDIA] Key extension: "${input.r2Key.split('.').pop()}"`)
      
      // Determine mime-type from HeadObject
      const head = await r2Client.send(
        new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: input.r2Key })
      )
      
      let mimeType = head.ContentType || undefined
      console.log(`📋 [TWITTER-MEDIA] R2 ContentType from header: "${mimeType}"`)
      console.log(`📋 [TWITTER-MEDIA] R2 head response:`, {
        ContentType: head.ContentType,
        ContentLength: head.ContentLength,
        LastModified: head.LastModified,
        ETag: head.ETag
      })
      
      if (!mimeType) {
        console.log(`🔄 [TWITTER-MEDIA] No ContentType from R2, using image-only fallback...`)
        const keyLower = input.r2Key.toLowerCase()
        if (keyLower.endsWith('.png')) {
          mimeType = 'image/png'
        } else if (keyLower.endsWith('.jpg') || keyLower.endsWith('.jpeg')) {
          mimeType = 'image/jpeg'
        }
      } else {
        console.log(`✅ [TWITTER-MEDIA] Using ContentType from R2 header`)
      }
      
      console.log(`🎯 [TWITTER-MEDIA] Final MIME type: "${mimeType}"`)
      
      // Only PNG/JPEG permitted
      const allowedImageTypes = new Set(['image/png', 'image/jpeg'])
      if (!mimeType || !allowedImageTypes.has(mimeType)) {
        throw new Error('Only PNG or JPEG images are allowed')
      }

      const obj = await r2Client.send(
        new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: input.r2Key })
      )

      const stream = obj.Body
      if (!stream) throw new Error('Failed to fetch media from R2')

      // Convert stream to Buffer for twitter-api-v2 with data integrity checks
      const chunks: Uint8Array[] = []
      let totalBytesRead = 0
      
      console.log(`📥 [TWITTER-MEDIA] Starting stream-to-buffer conversion...`)
      
      if (stream instanceof ReadableStream) {
        // Web ReadableStream
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value && value.length > 0) {
              chunks.push(value)
              totalBytesRead += value.length
            }
          }
        } finally {
          reader.releaseLock()
        }
      } else {
        // Node.js Readable stream
        const readable = stream as any
        for await (const chunk of readable) {
          if (chunk && chunk.length > 0) {
            chunks.push(new Uint8Array(chunk))
            totalBytesRead += chunk.length
          }
        }
      }

      if (chunks.length === 0) {
        throw new Error('No data received from R2 stream')
      }

      console.log(`📊 [TWITTER-MEDIA] Stream conversion complete: ${chunks.length} chunks, ${totalBytesRead} bytes total`)
      
      const buffer = Buffer.concat(chunks)
      console.log(`📦 [TWITTER-MEDIA] Buffer created: ${buffer.length} bytes`)
      
      // Verify buffer integrity
      if (buffer.length !== totalBytesRead) {
        console.warn(`⚠️ [TWITTER-MEDIA] Buffer size mismatch: expected ${totalBytesRead}, got ${buffer.length}`)
      }
      
      if (buffer.length === 0) {
        throw new Error('Buffer is empty after stream conversion')
      }
      
      if (!mimeType) {
        throw new Error('Could not determine MIME type for media')
      }

      // Image-only validation
      console.log(`📏 [TWITTER-MEDIA] ========== SIZE AND FORMAT VALIDATION ==========`)
      {
        console.log(`🖼️ [TWITTER-MEDIA] Validating image...`)
        // Image size limit: 5MB for regular images
        const maxImageSize = 5 * 1024 * 1024 // 5MB
        if (buffer.length > maxImageSize) {
          throw new Error(`Image file too large: ${Math.round(buffer.length / 1024 / 1024)}MB. Twitter limit is 5MB.`)
        }
        console.log(`✅ [TWITTER-MEDIA] Image validation passed: ${Math.round(buffer.length / 1024)}KB`)
      }
      
      const client = createUserTwitterClient(target.accessToken, target.accessSecret)
      
      console.log(`🔧 [TWITTER-MEDIA] ========== TWITTER UPLOAD DEBUG ==========`)
      console.log(`🔧 [TWITTER-MEDIA] MediaType: "${input.mediaType}"`)
      console.log(`🔧 [TWITTER-MEDIA] Using mimeType: "${mimeType}"`)
      console.log(`🔧 [TWITTER-MEDIA] Buffer size: ${buffer.length} bytes`)
       
      try {
        // Mirror upstream implementation: only pass mimeType
        const mediaId = await client.v1.uploadMedia(buffer, { mimeType })
        console.log(`✅ [TWITTER-MEDIA] Successfully uploaded to Twitter, media_id: ${mediaId}`)
        
        return { media_id: mediaId }
      } catch (error: any) {
        console.error(`❌ [TWITTER-MEDIA] Twitter upload failed:`, {
          error: error?.message,
          code: error?.code,
          data: error?.data,
          stack: error?.stack,
          mimeType,
          bufferSize: buffer.length,
          mediaType: input.mediaType,
          r2Key: input.r2Key,
        })

        // Mirror upstream-style messages
        const message = error?.message || 'Unknown error'
        if (message.includes('InvalidMedia')) {
          throw new Error(`Failed to process media: ${message}`)
        }
        if (message.includes('awaitForMediaProcessingCompletion')) {
          throw new Error('Media processing timeout: Twitter took too long to process the image.')
        }
        throw new Error(`Failed to upload media to Twitter: ${message}`)
      }
    }),

  postNow: protectedProcedure
    .input(
      z.object({
        text: z
          .string()
          .min(1, 'Tweet cannot be empty')
          .max(280, 'Tweet exceeds 280 characters'),
        accountId: z.string().optional(),
        mediaIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const accounts = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!accounts.length) {
        throw new Error('No connected Twitter accounts')
      }

      console.log('🔍 Selecting account for posting:', {
        userId: ctx.user.id,
        providedAccountId: input.accountId,
        availableAccounts: accounts.length,
      })

      let target: typeof accounts[0] | undefined

      if (input.accountId) {
        // Use specific account if provided
        target = accounts.find((a) => a.id === input.accountId)
        console.log('📌 Using provided account:', { accountId: input.accountId, found: !!target })
      } else {
        // Use active account if no specific account provided
        const activeAccountId = await AccountCache.getActiveAccountId(ctx.user.id)
        console.log('🎯 Looking for active account:', { activeAccountId })
        
        if (activeAccountId) {
          target = accounts.find((a) => a.accountId === activeAccountId)
          console.log('✅ Found active account:', { 
            activeAccountId, 
            foundAccount: target ? { id: target.id, accountId: target.accountId } : null 
          })
        }
        
        // Fallback to first account if no active account found
        if (!target) {
          target = accounts[0]
          console.log('⚠️ Using fallback (first account):', { 
            accountId: target.accountId,
            reason: activeAccountId ? 'active account not found in DB' : 'no active account set'
          })
        }
      }

      if (!target) {
        throw new Error('Selected account not found')
      }

      if (!target.accessToken || !target.accessSecret) {
        throw new Error('Account is missing credentials')
      }

      // First, store the tweet in database before posting to Twitter
      const tweetId = crypto.randomUUID()
      const [storedTweet] = await db
        .insert(tweets)
        .values({
          id: tweetId,
          userId: ctx.user.id,
          accountId: target.id,
          content: input.text,
          mediaIds: input.mediaIds || [],
          isScheduled: false,
          isPublished: false, // Will be updated to true after successful post
        })
        .returning()

      if (!storedTweet) {
        throw new Error('Failed to store tweet in database')
      }

      console.log('💾 Tweet stored in database:', {
        tweetId: storedTweet.id,
        userId: ctx.user.id,
        accountId: target.id,
      })

      const client = createUserTwitterClient(target.accessToken, target.accessSecret)

      try {
        const params: any = { text: input.text }
        if (input.mediaIds && input.mediaIds.length > 0) {
          params.media = { media_ids: input.mediaIds }
        }
        
        console.log('🚀 Posting to Twitter...', { tweetId: storedTweet.id })
        const result = await client.v2.tweet(params)
        
        // Update the stored tweet with Twitter ID and mark as published
        await db
          .update(tweets)
          .set({
            twitterId: result.data.id,
            isPublished: true,
            updatedAt: new Date(),
          })
          .where(eq(tweets.id, storedTweet.id))

        console.log('✅ Tweet posted and database updated:', {
          tweetId: storedTweet.id,
          twitterId: result.data.id,
        })

        return { success: true, tweetId: result.data.id, storedTweetId: storedTweet.id }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('Tweet failed', e)
        
        // Keep the tweet in database for potential retry, but don't mark as published
        console.log('❌ Tweet posting failed, keeping record in database for analysis:', {
          tweetId: storedTweet.id,
          error: e?.message,
        })
        
        const message = e?.data?.detail || e?.message || 'Failed to post tweet'
        throw new Error(message)
      }
    }),

  schedule: protectedProcedure
    .input(
      z.object({
        text: z
          .string()
          .min(1, 'Tweet cannot be empty')
          .max(280, 'Tweet exceeds 280 characters'),
        scheduledUnix: z.number().positive('Schedule time must be in the future'),
        mediaIds: z.array(z.string()).optional(),
        accountId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const accounts = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!accounts.length) {
        throw new Error('No connected Twitter accounts')
      }

      console.log('🔍 Selecting account for scheduling:', {
        userId: ctx.user.id,
        providedAccountId: input.accountId,
        availableAccounts: accounts.length,
      })

      let target: typeof accounts[0] | undefined

      if (input.accountId) {
        // Use specific account if provided
        target = accounts.find((a) => a.id === input.accountId)
        console.log('📌 Using provided account:', { accountId: input.accountId, found: !!target })
      } else {
        // Use active account if no specific account provided
        const activeAccountId = await AccountCache.getActiveAccountId(ctx.user.id)
        console.log('🎯 Looking for active account:', { activeAccountId })
        
        if (activeAccountId) {
          target = accounts.find((a) => a.accountId === activeAccountId)
          console.log('✅ Found active account:', { 
            activeAccountId, 
            foundAccount: target ? { id: target.id, accountId: target.accountId } : null 
          })
        }
        
        // Fallback to first account if no active account found
        if (!target) {
          target = accounts[0]
          console.log('⚠️ Using fallback (first account):', { 
            accountId: target.accountId,
            reason: activeAccountId ? 'active account not found in DB' : 'no active account set'
          })
        }
      }

      if (!target) {
        throw new Error('Selected account not found')
      }

      if (!target.accessToken || !target.accessSecret) {
        throw new Error('Account is missing credentials')
      }

      // Validate scheduling time is in the future (at least 1 minute)
      const now = Date.now()
      const minimumFutureTime = now + 60000 // 1 minute from now
      if (input.scheduledUnix * 1000 <= minimumFutureTime) {
        throw new Error('Schedule time must be at least 1 minute in the future')
      }

      // Validate scheduling time is reasonable (10 years max to prevent abuse)
      const maxFutureTime = now + (10 * 365 * 24 * 60 * 60 * 1000) // 10 years
      if (input.scheduledUnix * 1000 > maxFutureTime) {
        throw new Error('Schedule time cannot be more than 10 years in the future')
      }

      const tweetId = crypto.randomUUID()
      const baseUrl = getBaseUrl()

      // Schedule via QStash
      const { messageId } = await qstash.publishJSON({
        url: `${baseUrl}/api/scheduled/twitter/post`,
        body: { tweetId },
        notBefore: Math.floor(input.scheduledUnix),
      })

      // Create tweet record in database
      const [tweet] = await db
        .insert(tweets)
        .values({
          id: tweetId,
          userId: ctx.user.id,
          accountId: target.id,
          content: input.text,
          mediaIds: input.mediaIds || [],
          isScheduled: true,
          scheduledUnix: input.scheduledUnix * 1000,
          scheduledFor: new Date(input.scheduledUnix * 1000),
          qstashId: messageId,
        })
        .returning()

      if (!tweet) {
        // Cleanup QStash job if DB insert failed
        try {
          await qstash.messages.delete(messageId)
        } catch (err) {
          // Log error but don't fail
          console.error('Failed to cleanup QStash message:', err)
        }
        throw new Error('Failed to schedule tweet')
      }

      return {
        success: true,
        tweetId: tweet.id,
        scheduledFor: tweet.scheduledFor,
        accountId: target.id,
      }
    }),

  getScheduled: protectedProcedure
    .query(async ({ ctx }) => {
      const accounts = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!accounts.length) {
        throw new Error('No connected Twitter accounts')
      }

      const accountIds = accounts.map(a => a.id)

      const scheduledTweets = await db
        .select()
        .from(tweets)
        .where(and(
          eq(tweets.userId, ctx.user.id),
          eq(tweets.isScheduled, true),
          eq(tweets.isPublished, false)
        ))
        .orderBy(desc(tweets.scheduledFor))

      return scheduledTweets.map(tweet => ({
        id: tweet.id,
        content: tweet.content,
        scheduledFor: tweet.scheduledFor,
        scheduledUnix: tweet.scheduledUnix,
        mediaIds: tweet.mediaIds,
        accountId: tweet.accountId,
        createdAt: tweet.createdAt,
      }))
    }),

  updateScheduled: protectedProcedure
    .input(
      z.object({
        tweetId: z.string(),
        text: z
          .string()
          .min(1, 'Tweet cannot be empty')
          .max(280, 'Tweet exceeds 280 characters'),
        scheduledUnix: z.number().positive('Schedule time must be in the future'),
        mediaIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing tweet
      const existingTweet = await db
        .select()
        .from(tweets)
        .where(and(
          eq(tweets.id, input.tweetId),
          eq(tweets.userId, ctx.user.id),
          eq(tweets.isScheduled, true),
          eq(tweets.isPublished, false)
        ))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!existingTweet) {
        throw new Error('Scheduled tweet not found')
      }

      // Validate scheduling time is in the future (at least 1 minute)
      const now = Date.now()
      const minimumFutureTime = now + 60000 // 1 minute from now
      if (input.scheduledUnix * 1000 <= minimumFutureTime) {
        throw new Error('Schedule time must be at least 1 minute in the future')
      }

      // Validate scheduling time is reasonable (10 years max to prevent abuse)
      const maxFutureTime = now + (10 * 365 * 24 * 60 * 60 * 1000) // 10 years
      if (input.scheduledUnix * 1000 > maxFutureTime) {
        throw new Error('Schedule time cannot be more than 10 years in the future')
      }

      // Cancel existing QStash job
      if (existingTweet.qstashId) {
        try {
          await qstash.messages.delete(existingTweet.qstashId)
        } catch (err) {
          console.error('Failed to cancel existing QStash job:', err)
          throw new Error('Failed to cancel existing scheduled tweet')
        }
      }

      const baseUrl = getBaseUrl()

      // Create new QStash job
      const { messageId } = await qstash.publishJSON({
        url: `${baseUrl}/api/scheduled/twitter/post`,
        body: { tweetId: input.tweetId },
        notBefore: Math.floor(input.scheduledUnix),
      })

      // Update tweet in database
      const [updatedTweet] = await db
        .update(tweets)
        .set({
          content: input.text,
          mediaIds: input.mediaIds || [],
          scheduledUnix: input.scheduledUnix * 1000,
          scheduledFor: new Date(input.scheduledUnix * 1000),
          qstashId: messageId,
          updatedAt: new Date(),
        })
        .where(eq(tweets.id, input.tweetId))
        .returning()

      if (!updatedTweet) {
        // Cleanup new QStash job if DB update failed
        try {
          await qstash.messages.delete(messageId)
        } catch (err) {
          console.error('Failed to cleanup QStash job:', err)
        }
        throw new Error('Failed to update scheduled tweet')
      }

      return {
        success: true,
        tweetId: updatedTweet.id,
        scheduledFor: updatedTweet.scheduledFor,
        accountId: updatedTweet.accountId,
      }
    }),

  cancelScheduled: protectedProcedure
    .input(
      z.object({
        tweetId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing tweet
      const existingTweet = await db
        .select()
        .from(tweets)
        .where(and(
          eq(tweets.id, input.tweetId),
          eq(tweets.userId, ctx.user.id),
          eq(tweets.isScheduled, true),
          eq(tweets.isPublished, false)
        ))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!existingTweet) {
        throw new Error('Scheduled tweet not found')
      }

      // Cancel QStash job
      if (existingTweet.qstashId) {
        try {
          await qstash.messages.delete(existingTweet.qstashId)
        } catch (err) {
          console.error('Failed to cancel QStash job:', err)
          throw new Error('Failed to cancel scheduled tweet')
        }
      }

      // Delete tweet from database
      await db.delete(tweets).where(eq(tweets.id, input.tweetId))

      return {
        success: true,
        tweetId: input.tweetId,
      }
    }),

  deleteAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1, 'Account ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the account exists and belongs to the current user
      const accountToDelete = await db
        .select()
        .from(account)
        .where(and(
          eq(account.id, input.accountId),
          eq(account.userId, ctx.user.id),
          eq(account.providerId, 'twitter')
        ))
        .limit(1)
        .then(rows => rows[0] || null)

      if (!accountToDelete) {
        throw new Error('Account not found or you do not have permission to delete it')
      }

      // Get cached account data to retrieve username for cache cleanup
      let username = ''
      try {
        const cachedAccount = await AccountCache.getAccount(ctx.user.id, accountToDelete.accountId)
        username = cachedAccount?.username || `user_${accountToDelete.accountId}`
      } catch {
        username = `user_${accountToDelete.accountId}`
      }

      try {
        // Delete all scheduled tweets for this account first
        await db
          .delete(tweets)
          .where(and(
            eq(tweets.accountId, input.accountId),
            eq(tweets.userId, ctx.user.id),
            eq(tweets.isScheduled, true),
            eq(tweets.isPublished, false)
          ))

        // Delete the account from database
        await db
          .delete(account)
          .where(eq(account.id, input.accountId))

        // Remove account from cache
        await AccountCache.removeAccount(ctx.user.id, accountToDelete.accountId, username)

        return {
          success: true,
          accountId: input.accountId,
        }
      } catch (error: any) {
        console.error('Failed to delete account:', error)
        throw new Error('Failed to delete account. Please try again.')
      }
    }),

  getPosted: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
        accountId: z.string().optional(),
        search: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const { limit = 20, cursor, accountId, search, dateFrom, dateTo } = input

      console.log('📋 Fetching posted tweets:', {
        userId: ctx.user.id,
        limit,
        cursor,
        accountId,
        search,
        dateFrom,
        dateTo,
      })

      // Get all user's Twitter accounts to filter by
      const userAccounts = await db
        .select({ id: account.id, accountId: account.accountId })
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!userAccounts.length) {
        return {
          tweets: [],
          nextCursor: null,
          hasMore: false,
        }
      }

      const accountIds = userAccounts.map(a => a.id)

      // Build query conditions
      const conditions = [
        eq(tweets.userId, ctx.user.id),
        eq(tweets.isPublished, true),
        // Only include tweets from user's Twitter accounts
        inArray(tweets.accountId, accountIds)
      ]

      // Add account filter if specified
      if (accountId) {
        conditions.push(eq(tweets.accountId, accountId))
      }

      // Add date filters if specified
      if (dateFrom) {
        conditions.push(gte(tweets.createdAt, dateFrom))
      }
      if (dateTo) {
        conditions.push(lte(tweets.createdAt, dateTo))
      }

      // Add cursor-based pagination
      if (cursor) {
        conditions.push(lt(tweets.createdAt, new Date(cursor)))
      }

      // Add search functionality using PostgreSQL's ILIKE for simple text search
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        conditions.push(ilike(tweets.content, searchTerm))
      }

      let query = db
        .select({
          id: tweets.id,
          content: tweets.content,
          mediaIds: tweets.mediaIds,
          twitterId: tweets.twitterId,
          createdAt: tweets.createdAt,
          updatedAt: tweets.updatedAt,
          accountId: tweets.accountId,
          // Join with account to get account details
          account: {
            id: account.id,
            accountId: account.accountId,
          }
        })
        .from(tweets)
        .innerJoin(account, eq(tweets.accountId, account.id))
        .where(and(...conditions))
        .orderBy(desc(tweets.createdAt))
        .limit(limit + 1) // Fetch one extra to determine if there are more

      const results = await query

      // Determine if there are more results
      const hasMore = results.length > limit
      const tweetsToReturn = hasMore ? results.slice(0, -1) : results

      // Get cached account data and real analytics for each tweet
      const enrichedTweets = await Promise.all(
        tweetsToReturn.map(async (tweet) => {
          try {
            const cachedAccount = await AccountCache.getAccount(ctx.user.id, tweet.account.accountId)
            
            // Fetch real analytics if feature enabled, twitterId exists and account has valid credentials
            let analytics = null
            if (ENABLE_TWITTER_ANALYTICS && tweet.twitterId) {
              try {
                // Get account credentials from database for analytics API call
                const dbAccount = await db
                  .select({ accessToken: account.accessToken, accessSecret: account.accessSecret })
                  .from(account)
                  .where(eq(account.id, tweet.accountId))
                  .limit(1)
                  .then(rows => rows[0] || null)

                if (dbAccount?.accessToken && dbAccount?.accessSecret) {
                  const client = createUserTwitterClient(dbAccount.accessToken, dbAccount.accessSecret)
                  const analyticsResult = await fetchTweetAnalytics(client, [tweet.twitterId])
                  const result = analyticsResult[0]
                  
                  if (result?.analytics) {
                    analytics = result.analytics
                  } else if (result?.error) {
                    console.warn(`Analytics unavailable for tweet ${tweet.twitterId}: ${result.error}`)
                  }
                }
              } catch (analyticsError) {
                console.warn('Failed to fetch analytics for tweet:', tweet.twitterId, analyticsError)
                // Continue without analytics rather than failing the whole request
              }
            }
            
            return {
              ...tweet,
              analytics,
              account: {
                id: tweet.account.id,
                accountId: tweet.account.accountId,
                username: cachedAccount?.username || `user_${tweet.account.accountId}`,
                displayName: cachedAccount?.displayName || cachedAccount?.username || `user_${tweet.account.accountId}`,
                profileImage: cachedAccount?.profileImage || '',
                verified: cachedAccount?.verified || false,
              }
            }
          } catch (error) {
            // Fallback if cache lookup fails
            return {
              ...tweet,
              analytics: null,
              account: {
                id: tweet.account.id,
                accountId: tweet.account.accountId,
                username: `user_${tweet.account.accountId}`,
                displayName: `user_${tweet.account.accountId}`,
                profileImage: '',
                verified: false,
              }
            }
          }
        })
      )

      const nextCursor = hasMore ? tweetsToReturn[tweetsToReturn.length - 1]?.createdAt.toISOString() : null

      console.log('✅ Posted tweets fetched:', {
        count: enrichedTweets.length,
        hasMore,
        nextCursor,
      })

      return {
        tweets: enrichedTweets,
        nextCursor,
        hasMore,
      }
    }),

  searchTweets: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1, 'Search query is required'),
        limit: z.number().min(1).max(50).default(20),
        accountId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      console.log('🔍 Searching tweets:', {
        userId: ctx.user.id,
        query: input.query,
        limit: input.limit,
        accountId: input.accountId,
      })

      // Get all user's Twitter accounts
      const userAccounts = await db
        .select({ id: account.id, accountId: account.accountId })
        .from(account)
        .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, 'twitter')))

      if (!userAccounts.length) {
        return { tweets: [] }
      }

      const accountIds = userAccounts.map(a => a.id)

      // Build search conditions
      const conditions = [
        eq(tweets.userId, ctx.user.id),
        eq(tweets.isPublished, true),
        inArray(tweets.accountId, accountIds),
        ilike(tweets.content, `%${input.query.trim()}%`)
      ]

      // Add account filter if specified
      if (input.accountId) {
        conditions.push(eq(tweets.accountId, input.accountId))
      }

      const results = await db
        .select({
          id: tweets.id,
          content: tweets.content,
          mediaIds: tweets.mediaIds,
          twitterId: tweets.twitterId,
          createdAt: tweets.createdAt,
          accountId: tweets.accountId,
          account: {
            id: account.id,
            accountId: account.accountId,
          }
        })
        .from(tweets)
        .innerJoin(account, eq(tweets.accountId, account.id))
        .where(and(...conditions))
        .orderBy(desc(tweets.createdAt))
        .limit(input.limit)

      // Enrich with cached account data
      const enrichedTweets = await Promise.all(
        results.map(async (tweet) => {
          try {
            const cachedAccount = await AccountCache.getAccount(ctx.user.id, tweet.account.accountId)
            
            return {
              ...tweet,
              account: {
                id: tweet.account.id,
                accountId: tweet.account.accountId,
                username: cachedAccount?.username || `user_${tweet.account.accountId}`,
                displayName: cachedAccount?.displayName || cachedAccount?.username || `user_${tweet.account.accountId}`,
                profileImage: cachedAccount?.profileImage || '',
                verified: cachedAccount?.verified || false,
              }
            }
          } catch (error) {
            return {
              ...tweet,
              account: {
                id: tweet.account.id,
                accountId: tweet.account.accountId,
                username: `user_${tweet.account.accountId}`,
                displayName: `user_${tweet.account.accountId}`,
                profileImage: '',
                verified: false,
              }
            }
          }
        })
      )

      console.log('✅ Tweet search completed:', {
        query: input.query,
        resultsCount: enrichedTweets.length,
      })

      return { tweets: enrichedTweets }
    }),
})