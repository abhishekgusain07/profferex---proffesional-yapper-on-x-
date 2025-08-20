import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    inferAdditionalFields({
      user: {
        plan: { type: 'string', defaultValue: 'free' },
        stripeId: { type: 'string', required: false },
        hadTrial: { type: 'boolean', defaultValue: false },
        goals: { type: 'object', required: false },
        frequency: { type: 'number', required: false },
      },
    }),
  ],
})

export const { useSession, signIn, signOut, signUp } = authClient