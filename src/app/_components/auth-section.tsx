'use client'

import { useSession, signIn, signOut, signUp } from '@/lib/auth-client'
import { useState } from 'react'

export function AuthSection() {
  const { data: session, isPending } = useSession()
  const [isSignUp, setIsSignUp] = useState(false)

  if (isPending) {
    return <div className="p-4 border rounded-lg">Loading session...</div>
  }

  if (!session) {
    return (
      <div className="p-4 border rounded-lg space-y-4">
        <h3 className="font-semibold">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const email = formData.get('email') as string
            const password = formData.get('password') as string
            const name = formData.get('name') as string

            try {
              if (isSignUp) {
                await signUp.email({
                  email,
                  password,
                  name,
                })
              } else {
                await signIn.email({
                  email,
                  password,
                })
              }
            } catch (error) {
              console.error('Auth error:', error)
            }
          }}
          className="space-y-3"
        >
          {isSignUp && (
            <input
              name="name"
              type="text"
              placeholder="Full Name"
              required
              className="w-full p-2 border rounded"
            />
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full p-2 border rounded"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full p-2 border rounded"
          />
          <button
            type="submit"
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-blue-500 hover:underline"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Welcome!</h3>
      <div className="space-y-2">
        <p><strong>Name:</strong> {session.user.name}</p>
        <p><strong>Email:</strong> {session.user.email}</p>
        <p><strong>ID:</strong> {session.user.id}</p>
      </div>
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Sign Out
      </button>
    </div>
  )
}