'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Eye,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Users,
  Clock
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface AnalyticsData {
  impressions: number
  engagements: number
  engagementRate: number
  likes: number
  retweets: number
  replies: number
  clicks: number
  views: number
  profileVisits: number
  trend: 'up' | 'down' | 'stable'
  comparison?: {
    period: string
    change: number
  }
}

interface TweetAnalyticsProps {
  tweetId: string
  analytics?: AnalyticsData
  variant?: 'detailed' | 'compact' | 'mini'
  showComparison?: boolean
  className?: string
}

// Animated Counter Component
function AnimatedCounter({ 
  value, 
  duration = 1000, 
  suffix = '' 
}: { 
  value: number
  duration?: number
  suffix?: string
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    const increment = end / (duration / 16) // 60fps
    
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)

    return () => clearInterval(timer)
  }, [value, duration])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <span className="tabular-nums">
      {formatNumber(count)}{suffix}
    </span>
  )
}

// Progress Bar Component
function AnimatedProgressBar({ 
  value, 
  max, 
  className = "",
  delay = 0 
}: { 
  value: number
  max: number
  className?: string
  delay?: number
}) {
  const [width, setWidth] = useState(0)
  const percentage = Math.min((value / max) * 100, 100)

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(percentage)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [percentage, delay])

  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-1000 ease-out ${className}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

// Trend Icon Component
function TrendIcon({ trend, change }: { trend: 'up' | 'down' | 'stable', change?: number }) {
  const icons = {
    up: <TrendingUp className="w-4 h-4 text-green-500" />,
    down: <TrendingDown className="w-4 h-4 text-red-500" />,
    stable: <Minus className="w-4 h-4 text-gray-400" />
  }

  const colors = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    stable: 'text-gray-600 bg-gray-50'
  }

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[trend]}`}>
      {icons[trend]}
      {change !== undefined && (
        <span>{Math.abs(change).toFixed(1)}%</span>
      )}
    </div>
  )
}

export function TweetAnalytics({ 
  tweetId, 
  analytics, 
  variant = 'detailed',
  showComparison = true,
  className = ""
}: TweetAnalyticsProps) {
  // Mock data for demonstration - in real app this would come from Twitter API
  const mockAnalytics: AnalyticsData = {
    impressions: 12500,
    engagements: 450,
    engagementRate: 3.6,
    likes: 230,
    retweets: 45,
    replies: 38,
    clicks: 89,
    views: 12500,
    profileVisits: 23,
    trend: 'up',
    comparison: {
      period: 'last 7 days',
      change: 12.5
    }
  }

  const data = analytics || mockAnalytics
  const maxEngagement = Math.max(data.likes, data.retweets, data.replies, data.clicks)

  if (variant === 'mini') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-1">
          <Heart className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium">
            <AnimatedCounter value={data.likes} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Repeat2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">
            <AnimatedCounter value={data.retweets} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">
            <AnimatedCounter value={data.replies} />
          </span>
        </div>
        <Badge 
          variant="secondary" 
          className="bg-purple-50 text-purple-700 text-xs"
        >
          <AnimatedCounter value={data.engagementRate} suffix="%" />
        </Badge>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Engagement Rate</span>
                <TrendIcon trend={data.trend} change={data.comparison?.change} />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                <AnimatedCounter value={data.engagementRate} suffix="%" />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm text-gray-600">Total Engagements</span>
              <div className="text-2xl font-bold text-gray-900">
                <AnimatedCounter value={data.engagements} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Detailed variant
  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Tweet Analytics
          </CardTitle>
          {showComparison && data.comparison && (
            <TrendIcon trend={data.trend} change={data.comparison.change} />
          )}
        </div>
        <p className="text-sm text-gray-600">
          Performance metrics • Updated {format(new Date(), 'MMM d, yyyy')}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-900 mb-1">
              <AnimatedCounter value={data.impressions} />
            </div>
            <div className="text-xs text-blue-700">Impressions</div>
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-900 mb-1">
              <AnimatedCounter value={data.engagements} />
            </div>
            <div className="text-xs text-purple-700">Engagements</div>
          </div>

          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-900 mb-1">
              <AnimatedCounter value={data.engagementRate} suffix="%" />
            </div>
            <div className="text-xs text-green-700">Engagement Rate</div>
          </div>

          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-orange-900 mb-1">
              <AnimatedCounter value={data.profileVisits} />
            </div>
            <div className="text-xs text-orange-700">Profile Visits</div>
          </div>
        </div>

        {/* Engagement Breakdown */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Engagement Breakdown
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Likes</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <AnimatedProgressBar 
                  value={data.likes} 
                  max={maxEngagement} 
                  className="bg-red-500"
                  delay={200}
                />
                <span className="text-sm font-medium text-gray-900 min-w-[3ch]">
                  <AnimatedCounter value={data.likes} duration={1200} />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Retweets</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <AnimatedProgressBar 
                  value={data.retweets} 
                  max={maxEngagement} 
                  className="bg-green-500"
                  delay={400}
                />
                <span className="text-sm font-medium text-gray-900 min-w-[3ch]">
                  <AnimatedCounter value={data.retweets} duration={1400} />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Replies</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <AnimatedProgressBar 
                  value={data.replies} 
                  max={maxEngagement} 
                  className="bg-blue-500"
                  delay={600}
                />
                <span className="text-sm font-medium text-gray-900 min-w-[3ch]">
                  <AnimatedCounter value={data.replies} duration={1600} />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Link Clicks</span>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <AnimatedProgressBar 
                  value={data.clicks} 
                  max={maxEngagement} 
                  className="bg-purple-500"
                  delay={800}
                />
                <span className="text-sm font-medium text-gray-900 min-w-[3ch]">
                  <AnimatedCounter value={data.clicks} duration={1800} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        {showComparison && data.comparison && (
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Performance vs {data.comparison.period}
            </h4>
            <div className="flex items-center gap-4">
              <TrendIcon trend={data.trend} change={data.comparison.change} />
              <p className="text-sm text-gray-600">
                {data.trend === 'up' ? 'Performing better' : data.trend === 'down' ? 'Performing worse' : 'Similar performance'} 
                {' '}compared to your average tweet from {data.comparison.period}
              </p>
            </div>
          </div>
        )}

        {/* Engagement Rate Indicator */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Performance</span>
            <Badge 
              className={`${
                data.engagementRate >= 5 
                  ? 'bg-green-100 text-green-800' 
                  : data.engagementRate >= 2
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {data.engagementRate >= 5 ? 'Excellent' : data.engagementRate >= 2 ? 'Good' : 'Average'}
            </Badge>
          </div>
          <div className="text-xs text-gray-600">
            Industry average: ~2.0% • Your tweet: <span className="font-medium"><AnimatedCounter value={data.engagementRate} suffix="%" /></span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default TweetAnalytics