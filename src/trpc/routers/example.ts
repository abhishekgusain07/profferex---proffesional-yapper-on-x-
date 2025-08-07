import { z } from 'zod'
import { 
  baseProcedure, 
  protectedProcedure,
  protectedServerAction,
  createTRPCRouter 
} from '../init'

export const exampleRouter = createTRPCRouter({
  // Public hello query
  hello: baseProcedure
    .input(z.object({ text: z.string().optional() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text ?? 'World'}!`,
        timestamp: new Date().toISOString(),
      }
    }),

  // Protected user info query
  getUser: protectedProcedure.query(({ ctx }) => {
    return {
      user: ctx.user,
      message: 'This is a protected route that requires authentication'
    }
  }),

  // Protected mutation example
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      bio: z.string().max(160).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Here you would update the user in your database
      // For now, just return the updated data
      return {
        success: true,
        user: {
          ...ctx.user,
          name: input.name,
          bio: input.bio,
        }
      }
    }),

  // Server Action example (for forms)
  updateProfileAction: protectedServerAction
    .meta({ span: 'update-profile' })
    .input(z.object({
      name: z.string().min(1).max(50),
      bio: z.string().max(160).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // This can be called from Server Actions
      return {
        success: true,
        user: {
          ...ctx.user,
          name: input.name,
          bio: input.bio,
        }
      }
    }),
})