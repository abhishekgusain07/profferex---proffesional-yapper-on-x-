import { TwitterApi } from 'twitter-api-v2'

export interface TweetAnalytics {
  likes: number
  retweets: number
  replies: number
  quotes: number
  views?: number
  impressions?: number
  profileClicks?: number
  urlClicks?: number
  engagementRate: number
}

export interface AnalyticsResult {
  tweetId: string
  analytics: TweetAnalytics | null
  error?: string
}

export async function fetchTweetAnalytics(
  client: TwitterApi,
  twitterIds: string[]
): Promise<AnalyticsResult[]> {
  if (!twitterIds.length) {
    return []
  }

  // Process in batches to respect rate limits (max 100 tweets per request)
  const BATCH_SIZE = 100
  const allResults: AnalyticsResult[] = []

  for (let i = 0; i < twitterIds.length; i += BATCH_SIZE) {
    const batch = twitterIds.slice(i, i + BATCH_SIZE)
    
    try {
      // Fetch tweets with both public and non-public metrics
      const response = await client.v2.tweets(batch, {
        'tweet.fields': ['public_metrics', 'non_public_metrics', 'created_at'],
      })

      if (!response.data) {
        // Add error results for this batch
        allResults.push(...batch.map(id => ({
          tweetId: id,
          analytics: null,
          error: 'No data returned from Twitter API'
        })))
        continue
      }

      // Convert response to our analytics format
      const batchResults: AnalyticsResult[] = response.data.map(tweet => {
        const publicMetrics = tweet.public_metrics
        const nonPublicMetrics = tweet.non_public_metrics

        if (!publicMetrics) {
          return {
            tweetId: tweet.id,
            analytics: null,
            error: 'Public metrics not available'
          }
        }

        // Calculate engagement rate (total engagement / impressions * 100)
        const totalEngagement = (publicMetrics.like_count || 0) + 
                               (publicMetrics.retweet_count || 0) + 
                               (publicMetrics.reply_count || 0) + 
                               (publicMetrics.quote_count || 0)
        
        const impressions = nonPublicMetrics?.impression_count || totalEngagement || 1
        const engagementRate = impressions > 0 ? (totalEngagement / impressions) * 100 : 0

        const analytics: TweetAnalytics = {
          likes: publicMetrics.like_count || 0,
          retweets: publicMetrics.retweet_count || 0,
          replies: publicMetrics.reply_count || 0,
          quotes: publicMetrics.quote_count || 0,
          views: nonPublicMetrics?.impression_count,
          impressions: nonPublicMetrics?.impression_count,
          profileClicks: nonPublicMetrics?.user_profile_clicks,
          urlClicks: nonPublicMetrics?.url_link_clicks,
          engagementRate: Math.round(engagementRate * 10) / 10, // Round to 1 decimal
        }

        return {
          tweetId: tweet.id,
          analytics,
        }
      })

      // Handle any missing tweets in this batch (not found in response)
      const returnedIds = new Set(response.data.map(tweet => tweet.id))
      const missingTweets = batch
        .filter(id => !returnedIds.has(id))
        .map(id => ({
          tweetId: id,
          analytics: null,
          error: 'Tweet not found or not accessible'
        }))

      allResults.push(...batchResults, ...missingTweets)

      // Add small delay between batches to be respectful of rate limits
      if (i + BATCH_SIZE < twitterIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (error: any) {
      console.error('Failed to fetch tweet analytics for batch:', batch, error)
      
      // Determine specific error type for better user experience
      let errorMessage = 'Failed to fetch analytics'
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded, try again later'
      } else if (error.code === 401) {
        errorMessage = 'Authentication failed'
      } else if (error.code === 403) {
        errorMessage = 'Access denied to tweet metrics'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      // Add error results for this batch
      allResults.push(...batch.map(id => ({
        tweetId: id,
        analytics: null,
        error: errorMessage
      })))
    }
  }

  return allResults
}

export async function fetchSingleTweetAnalytics(
  client: TwitterApi,
  twitterId: string
): Promise<AnalyticsResult> {
  const results = await fetchTweetAnalytics(client, [twitterId])
  return results[0] || {
    tweetId: twitterId,
    analytics: null,
    error: 'No result returned'
  }
}