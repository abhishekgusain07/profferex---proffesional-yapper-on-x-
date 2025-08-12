import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { twitterRouter } from './twitter'
import { filesRouter } from './files'
import { chatRouter } from './chat'
import { knowledgeRouter } from './knowledge'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  twitter: twitterRouter,
  files: filesRouter,
  chat: chatRouter,
  knowledge: knowledgeRouter,
})

export type AppRouter = typeof appRouter