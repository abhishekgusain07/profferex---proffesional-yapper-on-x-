import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { twitterRouter } from './twitter'
import { filesRouter } from './files'
import { chatRouter } from './chat'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  twitter: twitterRouter,
  files: filesRouter,
  chat: chatRouter,
})

export type AppRouter = typeof appRouter