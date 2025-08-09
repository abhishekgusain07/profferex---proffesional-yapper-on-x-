'use client'

import { trpc } from '@/trpc/client'
import { useSession } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Plus, Users, Settings, ExternalLink, Trash2, CheckCircle } from 'lucide-react'
import { useState } from 'react'

const AccountsPage = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const [connectingTwitter, setConnectingTwitter] = useState(false)

  const { data: twitterAccounts, isLoading: accountsLoading, refetch: refetchAccounts } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { enabled: !!session }
  )

  const createTwitterLink = trpc.twitter.createLink.useQuery(
    { action: 'add-account' },
    { enabled: false }
  )

  const handleConnectTwitter = async () => {
    setConnectingTwitter(true)
    try {
      const res = await createTwitterLink.refetch()
      const url = res.data?.url
      if (url) {
        window.location.href = url
      }
    } catch (e) {
      console.error('Failed to connect Twitter:', e)
    } finally {
      setConnectingTwitter(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to manage your accounts</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Account Management</h1>
              <p className="text-slate-600">Manage your connected accounts, writing style, and preferences</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Connected Accounts */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">All Connected Accounts</CardTitle>
                  <CardDescription>Your personal accounts and accounts delegated to you</CardDescription>
                </div>
                <Button
                  onClick={handleConnectTwitter}
                  disabled={connectingTwitter}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {connectingTwitter ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Account
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center gap-4 p-4 bg-slate-100 rounded-lg">
                        <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                          <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                        </div>
                        <div className="w-16 h-8 bg-slate-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : twitterAccounts && twitterAccounts.length > 0 ? (
                <div className="space-y-4">
                  {twitterAccounts.map((account: any) => (
                    <div key={account.id} className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                      <Avatar className="w-12 h-12 border border-slate-200">
                        <AvatarImage src={account.profileImage} alt={account.username} />
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                          {account.username?.charAt(0) || account.accountId?.charAt(0) || 'T'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">
                            {account.displayName || account.username || `Account ${account.accountId.slice(0, 8)}`}
                          </h3>
                          {account.isActive && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          @{account.username || account.accountId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-700">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No accounts connected</h3>
                  <p className="text-slate-600 mb-6">Connect your Twitter account to start posting</p>
                  <Button
                    onClick={handleConnectTwitter}
                    disabled={connectingTwitter}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {connectingTwitter ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Connect Twitter Account
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Post Settings */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Post Settings</CardTitle>
              <CardDescription>Configure posting behavior and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-start justify-between p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 mb-1">Skip Post Confirmation</h4>
                    <p className="text-sm text-slate-600">
                      When enabled, posts will be sent immediately without showing a confirmation modal
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Style Settings */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Style Settings</CardTitle>
              <CardDescription>Customize AI assistant output</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-slate-200">
                      <AvatarImage src={session.user?.image || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                        {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium text-slate-900">Writing Style & References</h4>
                      <p className="text-sm text-slate-600">
                        For @{session.user?.email?.split('@')[0] || 'your-handle'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default AccountsPage