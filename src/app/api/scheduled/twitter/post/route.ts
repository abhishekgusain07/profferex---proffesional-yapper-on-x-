import { NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { db } from '@/db'
import { tweets, account } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { createUserTwitterClient } from '@/lib/twitter'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    // Get request body and signature
    const body = await req.text()
    const signature = req.headers.get('Upstash-Signature') || ''

    // Verify QStash signature
    try {
      await receiver.verify({
        body,
        signature,
      })
    } catch (err) {
      console.error('QStash signature verification failed:', err)
      return new Response('Invalid signature', { status: 403 })
    }

    // Parse request body
    const { tweetId } = JSON.parse(body) as { tweetId: string }

    if (!tweetId) {
      return new Response('Missing tweetId', { status: 400 })
    }

    // Get tweet from database
    const tweet = await db
      .select()
      .from(tweets)
      .where(eq(tweets.id, tweetId))
      .limit(1)
      .then(rows => rows[0] || null)

    if (!tweet) {
      return new Response('Tweet not found', { status: 404 })
    }

    // Check if already published (idempotency)
    if (tweet.isPublished) {
      return new Response('Tweet already published', { status: 200 })
    }

    // Get account credentials
    const twitterAccount = await db
      .select()
      .from(account)
      .where(and(
        eq(account.id, tweet.accountId),
        eq(account.providerId, 'twitter')
      ))
      .limit(1)
      .then(rows => rows[0] || null)

    if (!twitterAccount || !twitterAccount.accessToken || !twitterAccount.accessSecret) {
      console.error('Twitter account not found or missing credentials')
      return new Response('Account not found or missing credentials', { status: 400 })
    }

    // Create Twitter client
    const client = createUserTwitterClient(twitterAccount.accessToken, twitterAccount.accessSecret)

    try {
      // Build tweet parameters
      const tweetParams: any = { text: tweet.content }
      
      // Add media if present
      if (tweet.mediaIds && tweet.mediaIds.length > 0) {
        tweetParams.media = { media_ids: tweet.mediaIds }
      }

      // Post tweet
      const result = await client.v2.tweet(tweetParams)

      // Update database - mark as published
      await db
        .update(tweets)
        .set({
          isPublished: true,
          isScheduled: false,
          twitterId: result.data.id,
          qstashId: null, // Clear QStash ID
          updatedAt: new Date(),
        })
        .where(eq(tweets.id, tweetId))

      console.log(`Successfully posted scheduled tweet ${tweetId}, Twitter ID: ${result.data.id}`)
      return new Response('Tweet posted successfully', { status: 200 })

    } catch (error: any) {
      console.error('Failed to post tweet:', error)
      
      // Log detailed error information for debugging
      console.error('Tweet posting error details:', {
        tweetId,
        accountId: tweet.accountId,
        error: error.message,
        stack: error.stack,
        tweetContent: tweet.content?.substring(0, 50) + '...',
      })
      
      // Don't mark as published on Twitter API errors
      // QStash will retry based on your retry configuration
      return new Response(`Failed to post tweet: ${error.message}`, { status: 500 })
    }

  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(`Webhook error: ${error.message}`, { status: 500 })
  }
}