'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { useSession, signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const Studio = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')

  // tRPC queries
  const { data: hello, isLoading: helloLoading } = trpc.example.hello.useQuery(
    { text: 'tRPC' },
    { enabled: !!session }
  )

  // Twitter OAuth link
  const createTwitterLink = trpc.twitter.createLink.useQuery(
    { action: 'add-account' },
    { enabled: false }
  )
  
  const { data: user, isLoading: userLoading, refetch: refetchUser } = trpc.example.getUser.useQuery(
    undefined,
    { enabled: !!session }
  )

  const { data: twitterAccounts, isLoading: accountsLoading, refetch: refetchAccounts } = trpc.twitter.getAccounts.useQuery(
    undefined,
    { enabled: !!session }
  )

  // tRPC mutation
  const updateProfile = trpc.example.updateProfile.useMutation({
    onSuccess: () => {
      refetchUser()
      setName('')
      setBio('')
    },
  })

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    updateProfile.mutate({
      name: name.trim(),
      bio: bio.trim() || undefined,
    })
  }

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Studio</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              try {
                const res = await createTwitterLink.refetch()
                const url = res.data?.url
                if (url) window.location.href = url
              } catch (e) {
                // no-op; could show toast
              }
            }}
          >
            Connect Twitter
          </Button>
          <Button variant="outline" onClick={() => signOut()}>
            Logout
          </Button>
        </div>
      </div>

      {/* Hello Query Example */}
      <Card>
        <CardHeader>
          <CardTitle>Hello Query</CardTitle>
          <CardDescription>Testing basic tRPC query</CardDescription>
        </CardHeader>
        <CardContent>
          {helloLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading greeting...</span>
            </div>
          ) : (
            <div>
              <p className="text-lg">{hello?.greeting}</p>
              <p className="text-sm text-muted-foreground">
                Timestamp: {hello?.timestamp}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Info Query */}
      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
          <CardDescription>Protected tRPC query</CardDescription>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading user data...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p><strong>Email:</strong> {user?.user.email}</p>
              <p><strong>Name:</strong> {user?.user.name || 'Not set'}</p>
              <p className="text-sm text-muted-foreground">{user?.message}</p>
              <div className="mt-4">
                <p className="font-semibold">Twitter accounts</p>
                {accountsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Loading…</span>
                  </div>
                ) : twitterAccounts && twitterAccounts.length > 0 ? (
                  <ul className="text-sm list-disc pl-6">
                    {twitterAccounts.map((a) => (
                      <li key={a.id}>Account ID: {a.accountId}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No Twitter accounts connected.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Profile Mutation */}
      <Card>
        <CardHeader>
          <CardTitle>Update Profile</CardTitle>
          <CardDescription>Test tRPC mutation</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="bio" className="block text-sm font-medium mb-1">
                Bio (optional)
              </label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
                maxLength={160}
              />
            </div>

            <Button 
              type="submit" 
              disabled={updateProfile.isPending || !name.trim()}
              className="w-full"
            >
              {updateProfile.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Updating...</span>
                </div>
              ) : (
                'Update Profile'
              )}
            </Button>

            {updateProfile.error && (
              <p className="text-sm text-red-600">
                Error: {updateProfile.error.message}
              </p>
            )}

            {updateProfile.isSuccess && (
              <p className="text-sm text-green-600">
                Profile updated successfully!
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Studio