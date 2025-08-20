'use client'

import TweetEditor from '@/components/tweet-editor/tweet-editor'
import { useSession } from '@/lib/auth-client'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const Studio = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const editTweetId = searchParams?.get('edit')
  const isEditMode = Boolean(editTweetId)

  // Progressive loading: Show auth modal only if no session and not loading
  useEffect(() => {
    if (!session && !sessionLoading && !isEditMode) {
      setShowAuthModal(true)
    } else {
      setShowAuthModal(false)
    }
  }, [session, sessionLoading, isEditMode])

  return (
    <>
      {/* Conditional auth modal instead of blocking render */}
      {showAuthModal && (
        <Dialog open={showAuthModal} onOpenChange={() => router.push('/sign-in')}>
          <DialogContent className="w-full max-w-md">
            <DialogHeader>
              <DialogTitle>Authentication Required</DialogTitle>
              <DialogDescription>
                Please log in to access the studio. You'll be redirected to the sign-in page.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-4">
              <button 
                onClick={() => router.push('/sign-in')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Always render main content - no blocking */}
      <div className="max-w-xl w-full mx-auto pt-8">
        {sessionLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading session...</span>
            </div>
          </div>
        ) : (
          <TweetEditor />
        )}
      </div>
    </>
  )
}

export default Studio