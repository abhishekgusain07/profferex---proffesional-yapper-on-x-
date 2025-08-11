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

  try {
    // Fetch tweets with both public and non-public metrics
    const response = await client.v2.tweets(twitterIds, {
      'tweet.fields': ['public_metrics', 'non_public_metrics', 'created_at'],
    })

    if (!response.data) {
      return twitterIds.map(id => ({
        tweetId: id,
        analytics: null,
        error: 'No data returned from Twitter API'
      }))
    }

    // Convert response to our analytics format
    const results: AnalyticsResult[] = response.data.map(tweet => {
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

    // Handle any missing tweets (not found in response)
    const returnedIds = new Set(response.data.map(tweet => tweet.id))
    const missingTweets = twitterIds
      .filter(id => !returnedIds.has(id))
      .map(id => ({
        tweetId: id,
        analytics: null,
        error: 'Tweet not found or not accessible'
      }))

    return [...results, ...missingTweets]

  } catch (error: any) {
    console.error('Failed to fetch tweet analytics:', error)
    
    // Return error results for all requested tweets
    return twitterIds.map(id => ({
      tweetId: id,
      analytics: null,
      error: error?.message || 'Failed to fetch analytics'
    }))
  }
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