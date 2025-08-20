'use client'

import TweetEditor from '@/components/tweet-editor/tweet-editor'
import { useSession } from '@/lib/auth-client'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const Studio = () => {
  const { data: session, isPending: sessionLoading } = useSession()

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading session...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access the studio</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl w-full mx-auto pt-8">
      <TweetEditor />
    </div>
  )
}

export default Studio