import { createTRPCRouter } from '../init'
import { exampleRouter } from './example'

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  // Add more routers here as needed
  // auth: authRouter,
  // user: userRouter,
})

export type AppRouter = typeof appRouter