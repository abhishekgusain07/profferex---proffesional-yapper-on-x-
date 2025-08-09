'use client'

import { useSession, signOut } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, Settings, User, Bell, Shield, Palette, Zap, LogOut } from 'lucide-react'
import { useState } from 'react'

const SettingsPage = () => {
  const { data: session, isPending: sessionLoading } = useSession()
  const [notifications, setNotifications] = useState(true)
  const [autoPost, setAutoPost] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

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
            <CardDescription>Please log in to access settings</CardDescription>
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
            <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-slate-100 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
              <p className="text-slate-600">Manage your account and application preferences</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-600" />
                <div>
                  <CardTitle className="text-lg">Profile</CardTitle>
                  <CardDescription>Your account information and preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="w-16 h-16 border-2 border-white shadow-lg">
                  <AvatarImage src={session.user?.image || undefined} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-medium text-lg">
                    {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">
                    {session.user?.name || 'Unnamed User'}
                  </h3>
                  <p className="text-slate-600">{session.user?.email}</p>
                  <Badge variant="outline" className="mt-2">
                    Free Plan
                  </Badge>
                </div>
                <Button variant="outline" disabled>
                  Change Photo
                </Button>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    defaultValue={session.user?.name || ''}
                    placeholder="Your display name"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={session.user?.email || ''}
                    disabled
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled>Save Changes</Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-slate-600" />
                <div>
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>Configure how you receive notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="notifications">Email Notifications</Label>
                  <p className="text-sm text-slate-600">
                    Receive updates about your scheduled posts and account activity
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-post">Auto-posting Notifications</Label>
                  <p className="text-sm text-slate-600">
                    Get notified when scheduled posts are published
                  </p>
                </div>
                <Switch
                  id="auto-post"
                  checked={autoPost}
                  onCheckedChange={setAutoPost}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-slate-600" />
                <div>
                  <CardTitle className="text-lg">Appearance</CardTitle>
                  <CardDescription>Customize how the application looks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-slate-600">
                    Switch to dark theme for better low-light usage
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-slate-600" />
                <div>
                  <CardTitle className="text-lg">Privacy & Security</CardTitle>
                  <CardDescription>Manage your privacy and security settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Shield className="w-4 h-4 mr-2" />
                  Two-Factor Authentication
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Zap className="w-4 h-4 mr-2" />
                  Connected Apps
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm border-red-200">
            <CardHeader>
              <CardTitle className="text-lg text-red-700">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <h4 className="font-medium text-red-900">Sign Out</h4>
                  <p className="text-sm text-red-700">
                    Sign out from your current session
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => signOut()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage