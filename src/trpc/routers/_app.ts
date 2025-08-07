import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { twitterRouter } from './twitter'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  twitter: twitterRouter,
})

export type AppRouter = typeof appRouter