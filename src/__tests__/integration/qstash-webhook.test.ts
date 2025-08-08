import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'

// Mock dependencies
const mockReceiver = {
  verify: jest.fn(),
}

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          then: jest.fn(),
        })),
      })),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(),
    })),
  })),
}

const mockTwitterClient = {
  v2: {
    tweet: jest.fn(),
  },
}

jest.mock('@upstash/qstash', () => ({
  Receiver: jest.fn().mockImplementation(() => mockReceiver),
}))

jest.mock('@/db', () => ({
  db: mockDb,
}))

jest.mock('@/lib/twitter', () => ({
  createUserTwitterClient: jest.fn(() => mockTwitterClient),
}))

// Import after mocking
import { POST } from '@/app/api/scheduled/twitter/post/route'

describe('QStash Webhook Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variables
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'current-key'
    process.env.QSTASH_NEXT_SIGNING_KEY = 'next-key'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('POST /api/scheduled/twitter/post', () => {
    it('should successfully post a scheduled tweet', async () => {
      const mockTweet = {
        id: 'tweet-123',
        content: 'Test scheduled tweet',
        mediaIds: ['media-1', 'media-2'],
        accountId: 'account-123',
        isPublished: false,
      }

      const mockAccount = {
        id: 'account-123',
        providerId: 'twitter',
        accessToken: 'access-token',
        accessSecret: 'access-secret',
      }

      const mockTwitterResponse = {
        data: { id: 'twitter-123' },
        errors: undefined,
      }

      // Setup mocks
      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet) // First call for tweet
        .mockResolvedValueOnce(mockAccount) // Second call for account
      mockTwitterClient.v2.tweet.mockResolvedValue(mockTwitterResponse)

      const requestBody = JSON.stringify({ tweetId: 'tweet-123' })
      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: requestBody,
        headers: {
          'Upstash-Signature': 'valid-signature',
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Tweet posted successfully')

      // Verify signature was checked
      expect(mockReceiver.verify).toHaveBeenCalledWith({
        body: requestBody,
        signature: 'valid-signature',
      })

      // Verify tweet was posted to Twitter
      expect(mockTwitterClient.v2.tweet).toHaveBeenCalledWith({
        text: 'Test scheduled tweet',
        media: { media_ids: ['media-1', 'media-2'] },
      })

      // Verify database was updated
      expect(mockDb.update().set).toHaveBeenCalledWith({
        isPublished: true,
        isScheduled: false,
        twitterId: 'twitter-123',
        qstashId: null,
        updatedAt: expect.any(Date),
      })
    })

    it('should handle invalid signature', async () => {
      mockReceiver.verify.mockRejectedValue(new Error('Invalid signature'))

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'tweet-123' }),
        headers: {
          'Upstash-Signature': 'invalid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(await response.text()).toBe('Invalid signature')
    })

    it('should handle missing tweetId', async () => {
      mockReceiver.verify.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Missing tweetId')
    })

    it('should handle tweet not found', async () => {
      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'nonexistent' }),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Tweet not found')
    })

    it('should handle already published tweet (idempotency)', async () => {
      const mockTweet = {
        id: 'tweet-123',
        content: 'Test tweet',
        isPublished: true, // Already published
      }

      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then.mockResolvedValue(mockTweet)

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'tweet-123' }),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Tweet already published')

      // Should not attempt to post again
      expect(mockTwitterClient.v2.tweet).not.toHaveBeenCalled()
    })

    it('should handle missing account credentials', async () => {
      const mockTweet = {
        id: 'tweet-123',
        content: 'Test tweet',
        accountId: 'account-123',
        isPublished: false,
      }

      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(null) // No account found

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'tweet-123' }),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Account not found or missing credentials')
    })

    it('should handle Twitter API error', async () => {
      const mockTweet = {
        id: 'tweet-123',
        content: 'Test tweet',
        accountId: 'account-123',
        isPublished: false,
      }

      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        accessSecret: 'secret',
      }

      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(mockAccount)
      
      // Mock Twitter API failure
      mockTwitterClient.v2.tweet.mockRejectedValue(new Error('Twitter API error'))

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'tweet-123' }),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(await response.text()).toContain('Failed to post tweet: Twitter API error')

      // Should not mark as published on Twitter error
      expect(mockDb.update().set).not.toHaveBeenCalled()
    })

    it('should handle tweet without media', async () => {
      const mockTweet = {
        id: 'tweet-123',
        content: 'Text only tweet',
        mediaIds: [], // No media
        accountId: 'account-123',
        isPublished: false,
      }

      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        accessSecret: 'secret',
      }

      const mockTwitterResponse = {
        data: { id: 'twitter-123' },
      }

      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(mockAccount)
      mockTwitterClient.v2.tweet.mockResolvedValue(mockTwitterResponse)

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'tweet-123' }),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)

      // Should post without media
      expect(mockTwitterClient.v2.tweet).toHaveBeenCalledWith({
        text: 'Text only tweet',
      })
    })

    it('should log detailed error information on failure', async () => {
      const mockTweet = {
        id: 'tweet-123',
        content: 'Test tweet',
        accountId: 'account-123',
        isPublished: false,
      }

      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        accessSecret: 'secret',
      }

      // Mock console.error to capture logs
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      mockReceiver.verify.mockResolvedValue(undefined)
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(mockAccount)
      
      const twitterError = new Error('Rate limit exceeded')
      twitterError.stack = 'Error: Rate limit exceeded\n  at ...'
      mockTwitterClient.v2.tweet.mockRejectedValue(twitterError)

      const request = new NextRequest('http://localhost:3000/api/scheduled/twitter/post', {
        method: 'POST',
        body: JSON.stringify({ tweetId: 'tweet-123' }),
        headers: {
          'Upstash-Signature': 'valid-signature',
        },
      })

      await POST(request)

      // Should log detailed error information
      expect(consoleSpy).toHaveBeenCalledWith('Tweet posting error details:', {
        tweetId: 'tweet-123',
        accountId: 'account-123',
        error: 'Rate limit exceeded',
        stack: expect.stringContaining('Error: Rate limit exceeded'),
        tweetContent: 'Test tweet...',
      })

      consoleSpy.mockRestore()
    })
  })
})