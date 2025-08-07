import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { redis } from '@/lib/redis'
import { twitterOAuthClient, createUserTwitterClient } from '@/lib/twitter'
import { getBaseUrl } from '@/constants/base-url'
import { db } from '@/db'
import { account } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

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
    .input(z.object({ r2Key: z.string().min(1), mediaType: z.enum(['image', 'gif', 'video']) }))
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
        console.log(`🔄 [TWITTER-MEDIA] No ContentType from R2, using fallback logic...`)
        // Better fallback logic based on file extension and media type
        const keyLower = input.r2Key.toLowerCase()
        console.log(`🔍 [TWITTER-MEDIA] Key toLowerCase: "${keyLower}"`)
        console.log(`🔍 [TWITTER-MEDIA] Checking conditions:`)
        console.log(`    - input.mediaType === 'gif': ${input.mediaType === 'gif'}`)
        console.log(`    - keyLower.endsWith('.gif'): ${keyLower.endsWith('.gif')}`)
        console.log(`    - input.mediaType === 'image': ${input.mediaType === 'image'}`)
        
        if (input.mediaType === 'gif' || keyLower.endsWith('.gif')) {
          mimeType = 'image/gif'
          console.log(`✅ [TWITTER-MEDIA] Classified as GIF`)
        } else if (input.mediaType === 'image') {
          console.log(`🖼️ [TWITTER-MEDIA] Processing as regular image...`)
          if (keyLower.endsWith('.png')) {
            mimeType = 'image/png'
            console.log(`✅ [TWITTER-MEDIA] Classified as PNG`)
          } else if (keyLower.endsWith('.jpg') || keyLower.endsWith('.jpeg')) {
            mimeType = 'image/jpeg'
            console.log(`✅ [TWITTER-MEDIA] Classified as JPEG`)
          } else {
            mimeType = 'image/png' // default fallback
            console.log(`⚠️ [TWITTER-MEDIA] No specific image type, defaulting to PNG`)
          }
        } else if (input.mediaType === 'video') {
          if (keyLower.endsWith('.mp4')) mimeType = 'video/mp4'
          else if (keyLower.endsWith('.mov')) mimeType = 'video/quicktime'
          else mimeType = 'video/mp4' // default fallback
          console.log(`✅ [TWITTER-MEDIA] Classified as video: ${mimeType}`)
        } else {
          console.log(`❌ [TWITTER-MEDIA] Unknown mediaType: "${input.mediaType}"`)
        }
      } else {
        console.log(`✅ [TWITTER-MEDIA] Using ContentType from R2 header`)
      }
      
      console.log(`🎯 [TWITTER-MEDIA] Final MIME type: "${mimeType}"`)
      
      // DEFENSIVE VALIDATION: Fix mediaType mismatches
      console.log(`🛡️ [TWITTER-MEDIA] ========== DEFENSIVE VALIDATION ==========`)
      let actualMediaType = input.mediaType
      
      // Override mediaType based on actual file format detection
      if (mimeType === 'image/gif') {
        if (input.mediaType !== 'gif') {
          console.log(`🚨 [TWITTER-MEDIA] MISMATCH DETECTED: input.mediaType="${input.mediaType}" but mimeType="${mimeType}"`)
          console.log(`🔧 [TWITTER-MEDIA] OVERRIDING mediaType from "${input.mediaType}" to "gif"`)
          actualMediaType = 'gif'
        } else {
          console.log(`✅ [TWITTER-MEDIA] mediaType matches: GIF`)
        }
      } else if (mimeType?.startsWith('image/') && mimeType !== 'image/gif') {
        if (input.mediaType !== 'image') {
          console.log(`🚨 [TWITTER-MEDIA] MISMATCH DETECTED: input.mediaType="${input.mediaType}" but mimeType="${mimeType}" (regular image)`)
          console.log(`🔧 [TWITTER-MEDIA] OVERRIDING mediaType from "${input.mediaType}" to "image"`)
          actualMediaType = 'image'
        } else {
          console.log(`✅ [TWITTER-MEDIA] mediaType matches: Image`)
        }
      } else if (mimeType?.startsWith('video/')) {
        if (input.mediaType !== 'video') {
          console.log(`🚨 [TWITTER-MEDIA] MISMATCH DETECTED: input.mediaType="${input.mediaType}" but mimeType="${mimeType}"`)
          console.log(`🔧 [TWITTER-MEDIA] OVERRIDING mediaType from "${input.mediaType}" to "video"`)
          actualMediaType = 'video'
        } else {
          console.log(`✅ [TWITTER-MEDIA] mediaType matches: Video`)
        }
      }
      
      console.log(`🎯 [TWITTER-MEDIA] Final actualMediaType: "${actualMediaType}" (was: "${input.mediaType}")`)

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

      // Add media-specific validation using corrected actualMediaType
      console.log(`📏 [TWITTER-MEDIA] ========== SIZE AND FORMAT VALIDATION ==========`)
      if (actualMediaType === 'gif') {
        console.log(`🎭 [TWITTER-MEDIA] Validating as GIF...`)
        // Twitter GIF limits: 15MB max, must be valid GIF format
        const maxGifSize = 15 * 1024 * 1024 // 15MB
        if (buffer.length > maxGifSize) {
          throw new Error(`GIF file too large: ${Math.round(buffer.length / 1024 / 1024)}MB. Twitter limit is 15MB.`)
        }
        
        // Basic GIF format validation - check GIF header
        const gifHeader = buffer.subarray(0, 6).toString('ascii')
        if (!gifHeader.startsWith('GIF87a') && !gifHeader.startsWith('GIF89a')) {
          throw new Error('Invalid GIF format. File does not have valid GIF header.')
        }
        
        console.log(`✅ [TWITTER-MEDIA] GIF validation passed: ${Math.round(buffer.length / 1024)}KB, format: ${gifHeader}`)
      } else if (actualMediaType === 'image') {
        console.log(`🖼️ [TWITTER-MEDIA] Validating as regular image...`)
        // Image size limit: 5MB for regular images
        const maxImageSize = 5 * 1024 * 1024 // 5MB
        if (buffer.length > maxImageSize) {
          throw new Error(`Image file too large: ${Math.round(buffer.length / 1024 / 1024)}MB. Twitter limit is 5MB.`)
        }
        console.log(`✅ [TWITTER-MEDIA] Image validation passed: ${Math.round(buffer.length / 1024)}KB`)
      } else if (actualMediaType === 'video') {
        console.log(`🎬 [TWITTER-MEDIA] Validating as video...`)
        // Video size limit: 512MB
        const maxVideoSize = 512 * 1024 * 1024 // 512MB
        if (buffer.length > maxVideoSize) {
          throw new Error(`Video file too large: ${Math.round(buffer.length / 1024 / 1024)}MB. Twitter limit is 512MB.`)
        }
        console.log(`✅ [TWITTER-MEDIA] Video validation passed: ${Math.round(buffer.length / 1024 / 1024)}MB`)
      } else {
        console.log(`❌ [TWITTER-MEDIA] Unknown actualMediaType for validation: "${actualMediaType}"`)
      }
      
      const client = createUserTwitterClient(target.accessToken, target.accessSecret)
      
      // Add proper media upload options based on Twitter API requirements
      const uploadOptions: any = { mimeType }
      
      console.log(`🔧 [TWITTER-MEDIA] ========== TWITTER UPLOAD OPTIONS DEBUG ==========`)
      console.log(`🔧 [TWITTER-MEDIA] Starting with input.mediaType: "${input.mediaType}"`)
      console.log(`🔧 [TWITTER-MEDIA] Starting with mimeType: "${mimeType}"`)
      console.log(`🔧 [TWITTER-MEDIA] Buffer size: ${buffer.length} bytes`)
      
      // Add media category for better Twitter processing
      if (input.mediaType === 'gif') {
        console.log(`🎭 [TWITTER-MEDIA] PROCESSING AS GIF - mediaType is 'gif'`)
        // GIFs need special handling - treat more like videos than images
        uploadOptions.media_category = 'tweet_gif'
        // Add additional options for GIF processing
        uploadOptions.shared = false // Prevent sharing during processing
        // Increase timeout for GIF processing (they take longer)
        uploadOptions.maxUploadRetries = 3
        uploadOptions.chunkSize = 5 * 1024 * 1024 // 5MB chunks for better handling
        console.log(`✅ [TWITTER-MEDIA] Set media_category = 'tweet_gif'`)
      } else if (input.mediaType === 'image') {
        console.log(`🖼️ [TWITTER-MEDIA] PROCESSING AS IMAGE - mediaType is 'image'`)
        uploadOptions.media_category = 'tweet_image'
        console.log(`✅ [TWITTER-MEDIA] Set media_category = 'tweet_image'`)
      } else if (input.mediaType === 'video') {
        console.log(`🎬 [TWITTER-MEDIA] PROCESSING AS VIDEO - mediaType is 'video'`)
        uploadOptions.media_category = 'tweet_video'
        // For larger videos, use longmp4 type
        if (buffer.length > 15 * 1024 * 1024) { // 15MB
          uploadOptions.type = 'longmp4'
          uploadOptions.maxUploadRetries = 3
          uploadOptions.chunkSize = 5 * 1024 * 1024 // 5MB chunks
          console.log(`✅ [TWITTER-MEDIA] Large video, set type = 'longmp4'`)
        }
        console.log(`✅ [TWITTER-MEDIA] Set media_category = 'tweet_video'`)
      } else {
        console.log(`❌ [TWITTER-MEDIA] UNKNOWN MEDIA TYPE: "${input.mediaType}"`)
        console.log(`❌ [TWITTER-MEDIA] This should not happen! Defaulting to 'tweet_image'`)
        uploadOptions.media_category = 'tweet_image'
      }
      
      console.log(`🚀 [TWITTER-MEDIA] Final upload options:`, {
        mimeType: uploadOptions.mimeType,
        media_category: uploadOptions.media_category,
        bufferSize: buffer.length,
        type: uploadOptions.type,
        shared: uploadOptions.shared,
        maxUploadRetries: uploadOptions.maxUploadRetries,
        chunkSize: uploadOptions.chunkSize
      })
      
      try {
        const mediaId = await client.v1.uploadMedia(buffer, uploadOptions)
        console.log(`✅ [TWITTER-MEDIA] Successfully uploaded to Twitter, media_id: ${mediaId}`)
        
        return { media_id: mediaId }
      } catch (error: any) {
        console.error(`❌ [TWITTER-MEDIA] Twitter upload failed:`, {
          error: error.message,
          code: error.code,
          data: error.data,
          stack: error.stack,
          mimeType,
          bufferSize: buffer.length,
          mediaType: input.mediaType,
          r2Key: input.r2Key
        })
        
        // Better error messages for common issues
        if (error.message?.includes('InvalidMedia')) {
          if (input.mediaType === 'gif') {
            throw new Error(`GIF processing failed: ${error.message}. This GIF may use unsupported features or be corrupted.`)
          } else {
            throw new Error(`Failed to process media: ${error.message}. Check if the file format is supported by Twitter.`)
          }
        } else if (error.message?.includes('awaitForMediaProcessingCompletion')) {
          throw new Error(`Media processing timeout: Twitter took too long to process the ${input.mediaType}. Try uploading a smaller or simpler file.`)
        } else if (error.code === 324) {
          throw new Error('Media file is too large or invalid format.')
        } else if (error.code === 325) {
          throw new Error('Media file is corrupted or unsupported.')
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
          throw new Error('Network error during upload. Please try again.')
        } else {
          throw new Error(`Failed to upload media to Twitter: ${error.message || 'Unknown error'}`)
        }
      }
    }),

  postNow: protectedProcedure
    .input(z.object({
      text: z.string().min(1, 'Tweet cannot be empty').max(280, 'Tweet exceeds 280 characters'),
      accountId: z.string().optional(), // if omitted, use the first connected
      mediaIds: z.array(z.string()).optional(),
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

      // enforce Twitter media rules: either 1 video/gif or up to 4 images (we assume client validates)

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
}) 