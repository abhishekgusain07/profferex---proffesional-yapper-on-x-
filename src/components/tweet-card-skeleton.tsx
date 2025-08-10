'use client'

import { Card, CardContent } from '@/components/ui/card'

interface TweetCardSkeletonProps {
  variant?: 'default' | 'compact'
  showAnalytics?: boolean
}

export function TweetCardSkeleton({ 
  variant = 'default', 
  showAnalytics = false 
}: TweetCardSkeletonProps) {
  return (
    <Card className={`animate-pulse ${
      variant === 'compact' ? 'p-3' : 'p-4'
    } border-0 shadow-sm bg-white/80 backdrop-blur-sm`}>
      <CardContent className="p-0 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`${
            variant === 'compact' ? 'w-10 h-10' : 'w-12 h-12'
          } bg-gray-200 rounded-full`} />
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
          
          <div className="w-6 h-6 bg-gray-200 rounded" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-4/5" />
          <div className="h-4 bg-gray-200 rounded w-3/5" />
        </div>

        {/* Media placeholder */}
        <div className="h-32 bg-gray-200 rounded-lg" />

        {/* Analytics */}
        {showAnalytics && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-8 mx-auto" />
                  <div className="h-3 bg-gray-200 rounded w-12 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="h-5 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

export default TweetCardSkeleton