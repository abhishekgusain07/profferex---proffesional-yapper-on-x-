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

export interface TweetWithAnalytics {
  id: string
  content: string
  mediaIds: string[]
  twitterId: string | null
  createdAt: Date
  analytics: TweetAnalytics | null
  account: {
    id: string
    accountId: string
    username: string
    displayName: string
    profileImage: string
    verified: boolean
  }
}