import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { twitterRouter } from './twitter'
import { filesRouter } from './files'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  twitter: twitterRouter,
  files: filesRouter,
})

export type AppRouter = typeof appRouter