'use client'

import { trpc } from '@/trpc/client'
import { useSession } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Plus, Users, ExternalLink, Trash2, CheckCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Save, Sparkles, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import AccountCardSkeleton from '@/components/account-card-skeleton'

interface TweetCardProps {
  src?: string
  username: string
  name: string
  text?: string
}

const TweetCard = ({ name, username, src, text }: TweetCardProps) => {
  return (
    <div className="w-full">
      <div className="text-left rounded-lg bg-white border border-dashed border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-start gap-3 p-6">
          <Avatar className="h-10 w-10 rounded-full border border-slate-200">
            <AvatarImage src={src} alt={`@${username}`} />
            <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
              {name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{name}</span>
              <span className="text-sm text-slate-600">@{username}</span>
            </div>
            <div className="mt-1 text-base whitespace-pre-line">{text}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const AccountsPage = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  // Direct tRPC queries for progressive loading
  const { data: twitterAccounts, isLoading: accountsLoading } = trpc.twitter.getAccounts.useQuery()
  const { data: activeAccount, isLoading: activeAccountLoading } = trpc.twitter.getActiveAccount.useQuery()
  const twitterDataLoading = accountsLoading || activeAccountLoading
  const [connectingTwitter, setConnectingTwitter] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null)
  const [connectionMessage, setConnectionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [tweetLink, setTweetLink] = useState('')
  const [prompt, setPrompt] = useState('')
  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false)

  // Use tRPC queries with optimized caching for operations that need refetch
  const twitterAccountsQuery = trpc.twitter.getAccounts.useQuery(
    undefined,
    { 
      enabled: !!session, 
      initialData: twitterAccounts,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 60 * 60 * 1000, // 1 hour
    }
  )

  const activeAccountQuery = trpc.twitter.getActiveAccount.useQuery(
    undefined,
    { 
      enabled: !!session, 
      initialData: activeAccount,
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: true,
    }
  )

  // Maintain compatibility with existing code
  const accountsLoading = twitterDataLoading
  const refetchAccounts = twitterAccountsQuery.refetch

  const createTwitterLink = trpc.twitter.createLink.useQuery(
    { action: 'add-account' },
    { enabled: false }
  )

  const deleteAccountMutation = trpc.twitter.deleteAccount.useMutation({
    onSuccess: () => {
      refetchAccounts()
      setDeleteModalOpen(false)
      setAccountToDelete(null)
    },
    onError: (error) => {
      console.error('Failed to delete account:', error)
      // Error will be shown in the UI via the mutation state
    },
    onSettled: () => {
      setDeletingAccount(false)
    },
  })

  const utils = trpc.useUtils()

  const setActiveAccountMutation = trpc.twitter.setActiveAccount.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await utils.twitter.getAccounts.cancel()
      await utils.twitter.getActiveAccount.cancel()

      // Snapshot the previous values
      const previousAccounts = utils.twitter.getAccounts.getData()
      const previousActiveAccount = utils.twitter.getActiveAccount.getData()

      // Optimistically update the accounts list
      if (previousAccounts) {
        const optimisticAccounts = previousAccounts.map(account => ({
          ...account,
          isActive: account.accountId === variables.accountId
        }))
        utils.twitter.getAccounts.setData(undefined, optimisticAccounts)
      }

      // Optimistically update the active account
      const newActiveAccount = previousAccounts?.find(acc => acc.accountId === variables.accountId)
      if (newActiveAccount) {
        utils.twitter.getActiveAccount.setData(undefined, { ...newActiveAccount, isActive: true })
      }

      return { previousAccounts, previousActiveAccount }
    },
    onSuccess: (data) => {
      console.log('✅ Account switch successful:', data)
      
      // Invalidate queries to get fresh data from server
      utils.twitter.getActiveAccount.invalidate()
      utils.twitter.getAccounts.invalidate()
      
      setConnectionMessage({ type: 'success', message: 'Account switched successfully!' })
    },
    onError: (error, variables, context) => {
      console.error('❌ Failed to switch account:', error)
      
      // Rollback optimistic updates on error
      if (context?.previousAccounts) {
        utils.twitter.getAccounts.setData(undefined, context.previousAccounts)
      }
      if (context?.previousActiveAccount) {
        utils.twitter.getActiveAccount.setData(undefined, context.previousActiveAccount)
      }
      
      setConnectionMessage({ type: 'error', message: 'Failed to switch account. Please try again.' })
    },
    onSettled: () => {
      setSwitchingAccount(null)
    },
  })

  // Style-related tRPC hooks
  const { data: style, refetch: refetchStyle } = trpc.style.get.useQuery(
    undefined,
    { enabled: !!session }
  )

  const importTweetMutation = trpc.style.import.useMutation({
    onSuccess: () => {
      setTweetLink('')
      refetchStyle()
    },
    onError: (error) => {
      setConnectionMessage({ type: 'error', message: error.message })
    },
  })

  const deleteTweetMutation = trpc.style.delete.useMutation({
    onSuccess: () => {
      refetchStyle()
    },
    onError: (error) => {
      setConnectionMessage({ type: 'error', message: error.message })
    },
  })

  const savePromptMutation = trpc.style.save.useMutation({
    onSuccess: () => {
      refetchStyle()
      setConnectionMessage({ type: 'success', message: 'Style saved successfully!' })
    },
    onError: (error) => {
      setConnectionMessage({ type: 'error', message: error.message })
    },
  })

  // Update prompt state when style data loads
  useEffect(() => {
    if (style?.prompt && typeof style.prompt === 'string') {
      setPrompt(style.prompt)
    }
  }, [style?.prompt])

  const handleConnectTwitter = () => {
    setConnectModalOpen(true)
  }

  const handleConfirmConnect = async () => {
    setConnectingTwitter(true)
    setConnectModalOpen(false)
    
    // Check session first
    if (!session) {
      setConnectionMessage({ 
        type: 'error', 
        message: 'Please log in first before connecting Twitter accounts.' 
      })
      setConnectingTwitter(false)
      return
    }
    
    console.log('Starting Twitter connection process...', {
      sessionExists: !!session,
      userId: session.user?.id,
    })
    
    try {
      const res = await createTwitterLink.refetch()
      
      // Check if there was an error in the response
      if (res.error) {
        console.error('tRPC Error Details:', {
          message: res.error.message,
          data: res.error.data,
          shape: res.error.shape,
        })
        
        const errorMessage = res.error.message || 'Failed to create Twitter authentication link'
        setConnectionMessage({ 
          type: 'error', 
          message: errorMessage 
        })
        return
      }
      
      const url = res.data?.url
      console.log('Twitter OAuth Response:', { 
        hasUrl: !!url, 
        url: url?.substring(0, 50) + '...' // Log first 50 chars for debugging
      })
      
      if (url) {
        window.location.href = url
      } else {
        console.error('No URL in successful response:', res.data)
        setConnectionMessage({ 
          type: 'error', 
          message: 'No authentication URL received from Twitter. Please try again.' 
        })
      }
    } catch (e: any) {
      console.error('Failed to connect Twitter - Full error:', {
        message: e?.message,
        data: e?.data,
        shape: e?.shape,
        stack: e?.stack,
        cause: e?.cause,
      })
      
      let errorMessage = 'Failed to initiate Twitter connection. Please try again.'
      
      // Extract more specific error messages
      if (e?.message) {
        errorMessage = e.message
      } else if (e?.data?.message) {
        errorMessage = e.data.message
      } else if (e?.shape?.message) {
        errorMessage = e.shape.message
      }
      
      setConnectionMessage({ 
        type: 'error', 
        message: errorMessage 
      })
    } finally {
      setConnectingTwitter(false)
    }
  }

  const handleCancelConnect = () => {
    setConnectModalOpen(false)
  }

  const handleDeleteClick = (account: { id: string; displayName?: string; username?: string; accountId: string }) => {
    setAccountToDelete({
      id: account.id,
      name: account.displayName || account.username || `Account ${account.accountId.slice(0, 8)}`,
    })
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return
    
    setDeletingAccount(true)
    try {
      await deleteAccountMutation.mutateAsync({ accountId: accountToDelete.id })
    } catch (error) {
      // Error handling is done in the mutation callbacks
      console.error('Delete failed:', error)
    }
  }

  const handleCancelDelete = () => {
    setDeleteModalOpen(false)
    setAccountToDelete(null)
  }

  const handleSwitchAccount = async (accountId: string) => {
    console.log('🔄 Switching to account:', {
      accountId,
      accountIdType: typeof accountId,
      accountIdLength: accountId?.length,
      accountIdValue: accountId,
    })

    // Validate accountId before sending
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      console.error('❌ Invalid accountId:', accountId)
      setConnectionMessage({ 
        type: 'error', 
        message: 'Invalid account ID. Please try refreshing the page.' 
      })
      return
    }

    setSwitchingAccount(accountId)
    try {
      const result = await setActiveAccountMutation.mutateAsync({ accountId })
      console.log('✅ Switch account mutation result:', result)
    } catch (error) {
      // Error handling is done in the mutation callbacks
      console.error('❌ Switch account failed:', error)
    }
  }

  // Check URL parameters for connection status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('account_connected') === 'true') {
      setConnectionMessage({ type: 'success', message: 'Twitter account connected successfully!' })
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (urlParams.get('error') === 'account_already_connected') {
      setConnectionMessage({ type: 'error', message: 'This Twitter account is already connected to your profile.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (urlParams.get('error')) {
      const error = urlParams.get('error')
      let message = 'Failed to connect Twitter account. Please try again.'
      if (error === 'expired_or_invalid_state') {
        message = 'Connection expired. Please try connecting again.'
      } else if (error === 'user_not_found') {
        message = 'Session expired. Please log in again.'
      }
      setConnectionMessage({ type: 'error', message })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Auto-hide connection messages after 5 seconds
  useEffect(() => {
    if (connectionMessage) {
      const timer = setTimeout(() => {
        setConnectionMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [connectionMessage])

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
          {/* Connection Status Message */}
          {connectionMessage && (
            <div className={`p-4 rounded-lg border ${
              connectionMessage.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {connectionMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{connectionMessage.message}</span>
              </div>
            </div>
          )}

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
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-lg border border-slate-200 animate-pulse">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-4 bg-gray-200 rounded w-32" />
                          <div className="h-4 bg-gray-200 rounded w-16" />
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-24" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 bg-gray-200 rounded w-20" />
                        <div className="h-8 bg-gray-200 rounded w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : twitterAccounts && twitterAccounts.length > 0 ? (
                <div className="space-y-4">
                  {twitterAccounts.filter((account) => {
                    // Filter out accounts with invalid accountId
                    const isValid = account.accountId && typeof account.accountId === 'string' && account.accountId.trim() !== ''
                    if (!isValid) {
                      console.warn('⚠️ Filtering out invalid account:', {
                        id: account.id,
                        accountId: account.accountId,
                        username: account.username,
                      })
                    }
                    return isValid
                  }).map((account) => {
                    console.log('📋 Rendering account:', {
                      id: account.id,
                      accountId: account.accountId,
                      username: account.username,
                      isActive: account.isActive,
                    })
                    return (
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
                          {account.verified && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 px-2 py-0.5 text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          @{account.username || account.accountId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {account.isActive ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSwitchAccount(account.accountId)}
                            disabled={switchingAccount === account.accountId}
                            className="text-slate-600 hover:text-slate-700 border-slate-300"
                          >
                            {switchingAccount === account.accountId ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Switching...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Make Active
                              </>
                            )}
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteClick(account)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    )
                  })}
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
              <Collapsible open={isStyleSettingsOpen} onOpenChange={setIsStyleSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full group">
                    <div className="flex items-center justify-between p-4 rounded-t-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {activeAccount && (
                          <Avatar className="w-10 h-10 border border-slate-200">
                            <AvatarImage src={activeAccount.profileImage} alt={`@${activeAccount.username}`} />
                            <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                              {activeAccount.displayName?.charAt(0) || activeAccount.username?.charAt(0) || 'T'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-800">
                              Writing Style & References
                            </h3>
                          </div>
                          {activeAccount && (
                            <p className="text-sm text-slate-600">For @{activeAccount.username}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isStyleSettingsOpen ? (
                          <ChevronDown className="w-5 h-5 text-slate-500 transition-transform" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-500 transition-transform" />
                        )}
                      </div>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white border border-t-0 border-slate-200 rounded-b-lg space-y-6 pt-4 pb-4">
                  {/* Fine-Tune Writing Style */}
                  <div className="px-4 space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800">
                        Fine-Tune Writing Style
                      </h4>
                      <p className="text-slate-600 text-sm">
                        Describe your writing preferences, tone, and style patterns
                      </p>
                    </div>

                    <Textarea
                      className="min-h-32"
                      placeholder="My tweets always use this emoji (◆) for bullet points and usually consist of a short, catchy intro hook and three bullet points. I love the 🎉 emoji"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />

                    <Button
                      onClick={() => savePromptMutation.mutate({ prompt })}
                      size="sm"
                      disabled={savePromptMutation.isPending}
                      className="w-fit bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {savePromptMutation.isPending ? (
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 w-4 h-4" />
                      )}
                      Save Writing Style
                    </Button>
                  </div>

                  <Separator className="mx-4" />

                  {/* Style Reference Tweets */}
                  <div className="px-4 space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800">
                        Style Reference Tweets
                      </h4>
                      <p className="text-slate-600 text-sm">
                        Import tweets that exemplify your desired writing style
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Input
                        value={tweetLink}
                        onChange={(e) => setTweetLink(e.target.value)}
                        className="flex-1"
                        type="text"
                        placeholder="https://x.com/username/status/1234567890123456789"
                      />
                      <Button
                        onClick={() => importTweetMutation.mutate({ link: tweetLink })}
                        disabled={importTweetMutation.isPending || !tweetLink.trim()}
                        variant="outline"
                        size="sm"
                        className="w-fit"
                      >
                        {importTweetMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Import'
                        )}
                      </Button>
                    </div>

                    <div className="">
                      {style?.tweets?.length ? (
                        <div className="space-y-4">
                          <p className="text-sm font-medium text-slate-700">
                            {style.tweets.length} reference tweet{style.tweets.length > 1 ? 's' : ''}
                          </p>
                          <div className="space-y-3">
                            {style.tweets.map((tweet, index) => (
                              <div className="relative" key={index}>
                                <Button
                                  variant="destructive"
                                  className="absolute top-3 right-3 w-fit p-1.5 text-white aspect-square z-10"
                                  onClick={() => deleteTweetMutation.mutate({ tweetId: tweet.id })}
                                  disabled={deleteTweetMutation.isPending}
                                  size="sm"
                                >
                                  {deleteTweetMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </Button>
                                <TweetCard
                                  username={tweet.author.username}
                                  name={tweet.author.name}
                                  src={tweet.author.profile_image_url}
                                  text={tweet.text}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Sparkles className="w-10 h-10 text-slate-300 mb-3" />
                          <p className="text-sm font-medium text-slate-700">
                            No imported tweets yet
                          </p>
                          <p className="text-xs text-slate-500 mt-1 max-w-xs">
                            Import tweets that match your desired writing style
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Delete Account
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-medium text-slate-900">{accountToDelete?.name}</span>?
              <br /><br />
              This action cannot be undone. All scheduled tweets for this account will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deletingAccount}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deletingAccount}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </Button>
          </DialogFooter>
          {deleteAccountMutation.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {deleteAccountMutation.error.message}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Connect Account Confirmation Dialog */}
      <Dialog open={connectModalOpen} onOpenChange={setConnectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Connect Twitter Account
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-600">
              You&apos;re about to connect a new Twitter account to your profile.
              <br /><br />
              <strong>Before connecting:</strong>
              <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                <li>Make sure you&apos;re logged into the correct Twitter account</li>
                <li>This will allow you to post content to that Twitter account</li>
                <li>You can connect multiple accounts and switch between them</li>
                <li>Each account can have its own posting schedule and settings</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCancelConnect}
              disabled={connectingTwitter}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmConnect}
              disabled={connectingTwitter}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {connectingTwitter ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Continue to Twitter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AccountsPage