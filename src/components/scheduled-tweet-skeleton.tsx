'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface ScheduledTweetSkeletonProps {
  count?: number
}

export function ScheduledTweetSkeleton({ count = 3 }: ScheduledTweetSkeletonProps) {
  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 bg-gray-200 rounded w-40 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-20 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="p-4 bg-slate-50/50 rounded-lg border border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Tweet content skeleton */}
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                  </div>
                  
                  {/* Metadata skeleton */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                    </div>
                  </div>
                  
                  {/* Status badges skeleton */}
                  <div className="flex items-center gap-2">
                    <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
                    <div className="h-5 bg-gray-200 rounded w-12 animate-pulse" />
                  </div>
                </div>
                
                {/* Action buttons skeleton */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default ScheduledTweetSkeleton