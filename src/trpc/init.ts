import { initTRPC, TRPCError } from '@trpc/server'
import { experimental_nextAppDirCaller } from '@trpc/server/adapters/next-app-dir'
import superjson from 'superjson'
import { cache } from 'react'
import { ZodError } from 'zod'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

// Get current session using better-auth
const getCurrentSession = cache(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    return session
  } catch (error) {
    // No active session
    return null
  }
})

export const createTRPCContext = cache(async () => {
  const session = await getCurrentSession()
  
  return {
    session,
    user: session?.user || null,
  }
})

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

// Meta interface for server actions
interface Meta {
  span: string
}

const t = initTRPC
  .context<TRPCContext>()
  .meta<Meta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      }
    },
  })

// Base router and procedure helpers
export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

// Base procedure
export const baseProcedure = t.procedure

// Server action procedure with experimental caller
export const serverActionProcedure = t.procedure.experimental_caller(
  experimental_nextAppDirCaller({
    pathExtractor: ({ meta }) => (meta as Meta).span,
    createContext: createTRPCContext,
  })
)

// Protected procedure for authenticated routes
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Ensures user is non-nullable
    },
  })
})

// Protected server action procedure
export const protectedServerAction = serverActionProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      })
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user, // Ensures user is non-nullable
      },
    })
  }
)