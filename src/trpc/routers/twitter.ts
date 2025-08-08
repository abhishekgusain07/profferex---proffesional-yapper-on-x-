import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { redis } from '@/lib/redis'
import { twitterOAuthClient, createUserTwitterClient } from '@/lib/twitter'
import { getBaseUrl } from '@/constants/base-url'
import { db } from '@/db'
import { account, tweets } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { qstash } from '@/lib/qstash'

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
        const params: any = { text: input.text }
        if (input.mediaIds && input.mediaIds.length > 0) {
          params.media = { media_ids: input.mediaIds }
        }
        const result = await client.v2.tweet(params)
        return { success: true, tweetId: result.data.id }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('Tweet failed', e)
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

      const target = input.accountId
        ? accounts.find((a) => a.id === input.accountId)
        : accounts[0]

      if (!target) {
        throw new Error('Selected account not found')
      }

      if (!target.accessToken || !target.accessSecret) {
        throw new Error('Account is missing credentials')
      }

      // Validate scheduling time is in the future
      const now = Date.now()
      if (input.scheduledUnix * 1000 <= now) {
        throw new Error('Schedule time must be in the future')
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
})