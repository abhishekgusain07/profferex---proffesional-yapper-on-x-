import { describe, it, expect } from '@jest/globals'
import { makeQueryClient } from '@/trpc/query-client'

describe('Query Client', () => {
  it('should create a QueryClient with proper defaults', () => {
    const queryClient = makeQueryClient()

    expect(queryClient).toBeDefined()
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30 * 1000)
  })

  it('should have retry logic configured', () => {
    const queryClient = makeQueryClient()
    const queryOptions = queryClient.getDefaultOptions().queries
    const mutationOptions = queryClient.getDefaultOptions().mutations

    expect(queryOptions?.retry).toBeDefined()
    expect(mutationOptions?.retry).toBeDefined()

    // Test retry function for queries
    if (typeof queryOptions?.retry === 'function') {
      // Should not retry on 400 errors
      expect(queryOptions.retry(1, { status: 400 })).toBe(false)
      // Should not retry on 404 errors
      expect(queryOptions.retry(1, { status: 404 })).toBe(false)
      // Should retry on 500 errors (up to 3 times)
      expect(queryOptions.retry(1, { status: 500 })).toBe(true)
      expect(queryOptions.retry(2, { status: 500 })).toBe(true)
      expect(queryOptions.retry(3, { status: 500 })).toBe(false)
    }

    // Test retry function for mutations
    if (typeof mutationOptions?.retry === 'function') {
      // Should not retry mutations on client errors
      expect(mutationOptions.retry(0, { status: 400 })).toBe(false)
      // Should retry once on server errors
      expect(mutationOptions.retry(0, { status: 500 })).toBe(true)
      expect(mutationOptions.retry(1, { status: 500 })).toBe(false)
    }
  })
})