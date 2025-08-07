import { describe, it, expect } from '@jest/globals'
import { z } from 'zod'

// Test input validation schemas from our example router
const helloSchema = z.object({
  text: z.string().optional()
})

const updateProfileSchema = z.object({
  name: z.string().min(1).max(50),
  bio: z.string().max(160).optional(),
})

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(100, 'Message too long'),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
})

describe('Example Validation Schemas', () => {
  describe('helloSchema', () => {
    it('should accept valid input with text', () => {
      const validInput = { text: 'Hello World' }
      const result = helloSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should accept input without text', () => {
      const validInput = {}
      const result = helloSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should accept input with undefined text', () => {
      const validInput = { text: undefined }
      const result = helloSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })
  })

  describe('updateProfileSchema', () => {
    it('should validate a valid profile update', () => {
      const validProfile = {
        name: 'John Doe',
        bio: 'Software developer'
      }
      const result = updateProfileSchema.safeParse(validProfile)
      expect(result.success).toBe(true)
    })

    it('should require a name', () => {
      const invalidProfile = {
        bio: 'Software developer'
      }
      const result = updateProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const invalidProfile = {
        name: '',
        bio: 'Software developer'
      }
      const result = updateProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })

    it('should reject name longer than 50 characters', () => {
      const invalidProfile = {
        name: 'a'.repeat(51),
        bio: 'Software developer'
      }
      const result = updateProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })

    it('should reject bio longer than 160 characters', () => {
      const invalidProfile = {
        name: 'John Doe',
        bio: 'a'.repeat(161)
      }
      const result = updateProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })

    it('should allow profile without bio', () => {
      const validProfile = {
        name: 'John Doe'
      }
      const result = updateProfileSchema.safeParse(validProfile)
      expect(result.success).toBe(true)
    })
  })

  describe('messageSchema', () => {
    it('should validate a valid message', () => {
      const validMessage = {
        message: 'Hello World',
        type: 'info' as const
      }
      const result = messageSchema.safeParse(validMessage)
      expect(result.success).toBe(true)
    })

    it('should default type to info', () => {
      const messageWithoutType = {
        message: 'Hello World'
      }
      const result = messageSchema.parse(messageWithoutType)
      expect(result.type).toBe('info')
    })

    it('should reject empty message', () => {
      const invalidMessage = {
        message: '',
        type: 'info' as const
      }
      const result = messageSchema.safeParse(invalidMessage)
      expect(result.success).toBe(false)
    })

    it('should reject message longer than 100 characters', () => {
      const invalidMessage = {
        message: 'a'.repeat(101),
        type: 'info' as const
      }
      const result = messageSchema.safeParse(invalidMessage)
      expect(result.success).toBe(false)
    })

    it('should reject invalid message type', () => {
      const invalidMessage = {
        message: 'Hello World',
        type: 'invalid' as any
      }
      const result = messageSchema.safeParse(invalidMessage)
      expect(result.success).toBe(false)
    })

    it('should accept all valid message types', () => {
      const types = ['info', 'success', 'warning', 'error'] as const
      
      types.forEach(type => {
        const validMessage = {
          message: 'Hello World',
          type
        }
        const result = messageSchema.safeParse(validMessage)
        expect(result.success).toBe(true)
      })
    })
  })
})