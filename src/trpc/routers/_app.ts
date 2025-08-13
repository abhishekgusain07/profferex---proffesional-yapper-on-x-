import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'
import { twitterRouter } from './twitter'
import { filesRouter } from './files'
import { chatRouter } from './chat'
import { knowledgeRouter } from './knowledge'
import { styleRouter } from './style'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  twitter: twitterRouter,
  files: filesRouter,
  chat: chatRouter,
  knowledge: knowledgeRouter,
  style: styleRouter,
})

export type AppRouter = typeof appRouter