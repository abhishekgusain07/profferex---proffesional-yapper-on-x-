'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Heart, 
  MessageCircle, 
  Repeat2,
  Eye,
  BarChart3,
  Download,
  Calendar,
  Clock
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

interface Tweet {
  id: string
  content: string
  createdAt: Date
  analytics?: {
    likes: number
    retweets: number
    replies: number
    views: number
    impressions: number
    engagementRate: number
  }
}

interface AnalyticsDashboardProps {
  tweets: Tweet[]
  className?: string
}

interface MetricCard {
  title: string
  value: number | string
  change?: number
  trend: 'up' | 'down' | 'stable'
  icon: React.ReactNode
  color: string
}

export function AnalyticsDashboard({ tweets, className = '' }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  // Filter tweets by time range
  const filteredTweets = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const cutoffDate = subDays(new Date(), days)
    return tweets.filter(tweet => tweet.createdAt >= cutoffDate)
  }, [tweets, timeRange])

  // Calculate aggregate metrics
  const metrics = useMemo(() => {
    const totalTweets = filteredTweets.length
    
    if (totalTweets === 0) {
      return {
        totalTweets: 0,
        totalLikes: 0,
        totalRetweets: 0,
        totalReplies: 0,
        totalViews: 0,
        totalImpressions: 0,
        avgEngagementRate: 0,
        bestPerformingTweet: null,
        totalEngagements: 0
      }
    }

    const totals = filteredTweets.reduce((acc, tweet) => {
      const analytics = tweet.analytics || {
        likes: 0, retweets: 0, replies: 0, views: 0, impressions: 0, engagementRate: 0
      }
      
      return {
        likes: acc.likes + analytics.likes,
        retweets: acc.retweets + analytics.retweets,
        replies: acc.replies + analytics.replies,
        views: acc.views + analytics.views,
        impressions: acc.impressions + analytics.impressions,
        engagementRate: acc.engagementRate + analytics.engagementRate
      }
    }, { likes: 0, retweets: 0, replies: 0, views: 0, impressions: 0, engagementRate: 0 })

    const totalEngagements = totals.likes + totals.retweets + totals.replies
    const avgEngagementRate = totals.engagementRate / totalTweets

    // Find best performing tweet
    const bestPerformingTweet = filteredTweets.reduce((best, tweet) => {
      const tweetEngagements = (tweet.analytics?.likes || 0) + 
                              (tweet.analytics?.retweets || 0) + 
                              (tweet.analytics?.replies || 0)
      const bestEngagements = (best?.analytics?.likes || 0) + 
                             (best?.analytics?.retweets || 0) + 
                             (best?.analytics?.replies || 0)
      
      return tweetEngagements > bestEngagements ? tweet : best
    }, filteredTweets[0])

    return {
      totalTweets,
      totalLikes: totals.likes,
      totalRetweets: totals.retweets,
      totalReplies: totals.replies,
      totalViews: totals.views,
      totalImpressions: totals.impressions,
      avgEngagementRate,
      bestPerformingTweet,
      totalEngagements
    }
  }, [filteredTweets])

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  // Generate mock trend data (in real app would come from historical data)
  const generateTrend = (): 'up' | 'down' | 'stable' => {
    const trends: ('up' | 'down' | 'stable')[] = ['up', 'down', 'stable']
    return trends[Math.floor(Math.random() * trends.length)]
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Total Impressions',
      value: formatNumber(metrics.totalImpressions),
      change: 12.5,
      trend: 'up',
      icon: <Eye className="w-5 h-5" />,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      title: 'Total Engagements',
      value: formatNumber(metrics.totalEngagements),
      change: -3.2,
      trend: 'down',
      icon: <Heart className="w-5 h-5" />,
      color: 'text-red-600 bg-red-100'
    },
    {
      title: 'Engagement Rate',
      value: `${metrics.avgEngagementRate.toFixed(1)}%`,
      change: 8.7,
      trend: 'up',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-600 bg-green-100'
    },
    {
      title: 'Profile Visits',
      value: formatNumber(Math.floor(metrics.totalViews * 0.1)),
      change: 15.3,
      trend: 'up',
      icon: <Users className="w-5 h-5" />,
      color: 'text-purple-600 bg-purple-100'
    }
  ]

  const engagementBreakdown = [
    {
      label: 'Likes',
      value: metrics.totalLikes,
      icon: <Heart className="w-4 h-4 text-red-500" />,
      percentage: metrics.totalEngagements ? (metrics.totalLikes / metrics.totalEngagements) * 100 : 0
    },
    {
      label: 'Retweets',
      value: metrics.totalRetweets,
      icon: <Repeat2 className="w-4 h-4 text-green-500" />,
      percentage: metrics.totalEngagements ? (metrics.totalRetweets / metrics.totalEngagements) * 100 : 0
    },
    {
      label: 'Replies',
      value: metrics.totalReplies,
      icon: <MessageCircle className="w-4 h-4 text-blue-500" />,
      percentage: metrics.totalEngagements ? (metrics.totalReplies / metrics.totalEngagements) * 100 : 0
    }
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
            <p className="text-gray-600">Performance insights for your tweets</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => (
          <Card key={index} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${metric.color}`}>
                  {metric.icon}
                </div>
                {metric.change !== undefined && (
                  <div className={`flex items-center gap-1 text-sm ${
                    metric.trend === 'up' ? 'text-green-600' : 
                    metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {metric.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : metric.trend === 'down' ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : null}
                    {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                <div className="text-sm text-gray-600">{metric.title}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Engagement Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {engagementBreakdown.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{formatNumber(item.value)}</span>
                    <span className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      index === 0 ? 'bg-red-500' : 
                      index === 1 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Best Performing Tweet */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Top Performing Tweet</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.bestPerformingTweet ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900 line-clamp-3">
                    {metrics.bestPerformingTweet.content}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {format(metrics.bestPerformingTweet.createdAt, 'MMM d, yyyy')}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-red-600">
                      {formatNumber(metrics.bestPerformingTweet.analytics?.likes || 0)}
                    </div>
                    <div className="text-xs text-gray-600">Likes</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {formatNumber(metrics.bestPerformingTweet.analytics?.retweets || 0)}
                    </div>
                    <div className="text-xs text-gray-600">Retweets</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {formatNumber(metrics.bestPerformingTweet.analytics?.replies || 0)}
                    </div>
                    <div className="text-xs text-gray-600">Replies</div>
                  </div>
                </div>

                <Badge className="w-full justify-center bg-green-100 text-green-800">
                  {metrics.bestPerformingTweet.analytics?.engagementRate.toFixed(1)}% engagement rate
                </Badge>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tweets to analyze</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{metrics.totalTweets}</div>
              <div className="text-sm text-gray-600">Total Tweets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics.totalTweets > 0 ? Math.round(metrics.totalEngagements / metrics.totalTweets) : 0}
              </div>
              <div className="text-sm text-gray-600">Avg. Engagements</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(metrics.totalViews)}
              </div>
              <div className="text-sm text-gray-600">Total Views</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {timeRange === '7d' ? '1 week' : timeRange === '30d' ? '1 month' : '3 months'}
              </div>
              <div className="text-sm text-gray-600">Time Period</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AnalyticsDashboard