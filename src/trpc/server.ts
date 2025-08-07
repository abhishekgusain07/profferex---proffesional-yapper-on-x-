import 'server-only'

import { createHydrationHelpers } from '@trpc/react-query/rsc'
import { cache } from 'react'
import { createTRPCContext, createCallerFactory } from './init'
import { makeQueryClient } from './query-client'
import { appRouter } from './routers/_app'

// IMPORTANT: Create a stable getter for the query client that
// will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient)

// Create caller factory
const caller = createCallerFactory(appRouter)(createTRPCContext)

// Create hydration helpers for RSC
export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient
)

// Export the caller directly for server-side usage
export { caller }