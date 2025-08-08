import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { 
  createMockTweet,
  createMockAccount,
  createMockTRPCContext,
  createMockQStashResponse,
  createMockTwitterResponse 
} from '../setup/scheduling-test-setup'

// Mock all dependencies
const mockQstash = {
  publishJSON: jest.fn(),
  messages: {
    delete: jest.fn(),
  },
}

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          then: jest.fn(),
        })),
        orderBy: jest.fn(() => []),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => []),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(),
    })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(),
  })),
}

const mockTwitterClient = {
  v2: {
    tweet: jest.fn(),
  },
}

const mockReceiver = {
  verify: jest.fn(),
}

// Setup mocks
jest.mock('@/lib/qstash', () => ({ qstash: mockQstash }))
jest.mock('@/db', () => ({ db: mockDb }))
jest.mock('@/lib/twitter', () => ({
  createUserTwitterClient: jest.fn(() => mockTwitterClient),
}))
jest.mock('@upstash/qstash', () => ({
  Receiver: jest.fn().mockImplementation(() => mockReceiver),
}))
jest.mock('@/constants/base-url', () => ({
  getBaseUrl: () => 'http://localhost:3000',
}))

// Import after mocking
import { twitterRouter } from '@/trpc/routers/twitter'
import { POST } from '@/app/api/scheduled/twitter/post/route'
import { NextRequest } from 'next/server'

describe('Tweet Scheduling End-to-End Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default successful mocks
    mockDb.select().from().where().then.mockResolvedValue([createMockAccount()])
    mockQstash.publishJSON.mockResolvedValue(createMockQStashResponse())
    mockReceiver.verify.mockResolvedValue(undefined)
    mockTwitterClient.v2.tweet.mockResolvedValue(createMockTwitterResponse())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Complete Scheduling Workflow', () => {
    it('should successfully schedule, process, and post a tweet', async () => {
      // Step 1: Schedule a tweet via tRPC
      const context = createMockTRPCContext()
      const caller = twitterRouter.createCaller(context)
      const futureTime = Math.floor((Date.now() + 3600000) / 1000) // 1 hour from now

      const mockScheduledTweet = createMockTweet({
        scheduledUnix: futureTime * 1000,
        scheduledFor: new Date(futureTime * 1000),
      })

      mockDb.insert().values().returning.mockResolvedValue([mockScheduledTweet])

      // Schedule the tweet
      const scheduleResult = await caller.schedule({
        text: 'Test scheduled tweet',
        scheduledUnix: futureTime,
        mediaIds: ['media-1', 'media-2'],
      })

      expect(scheduleResult).toEqual({
        success: true,
        tweetId: 'tweet-123',
        scheduledFor: mockScheduledTweet.scheduledFor,
        accountId: 'account-123',
      })

      // Verify QStash job was created
      expect(mockQstash.publishJSON).toHaveBeenCalledWith({
        url: 'http://localhost:3000/api/scheduled/twitter/post',
        body: { tweetId: 'tweet-123' },
        notBefore: futureTime,
      })

      // Step 2: Verify the tweet is in scheduled state
      mockDb.select().from().where().orderBy.mockResolvedValue([mockScheduledTweet])
      
      const scheduledTweets = await caller.getScheduled()
      expect(scheduledTweets).toHaveLength(1)
      expect(scheduledTweets[0].id).toBe('tweet-123')
      expect(scheduledTweets[0].content).toBe('Test scheduled tweet')

      // Step 3: Simulate QStash webhook execution
      const mockTweetForWebhook = createMockTweet({
        content: 'Test scheduled tweet',
        mediaIds: ['media-1', 'media-2'],
      })
      
      const mockAccountForWebhook = createMockAccount()

      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweetForWebhook) // Tweet lookup
        .mockResolvedValueOnce(mockAccountForWebhook) // Account lookup

      const webhookRequest = new NextRequest(
        'http://localhost:3000/api/scheduled/twitter/post',
        {
          method: 'POST',
          body: JSON.stringify({ tweetId: 'tweet-123' }),
          headers: {
            'Upstash-Signature': 'valid-signature',
            'Content-Type': 'application/json',
          },
        }
      )

      const webhookResponse = await POST(webhookRequest)
      expect(webhookResponse.status).toBe(200)

      // Verify Twitter API was called correctly
      expect(mockTwitterClient.v2.tweet).toHaveBeenCalledWith({
        text: 'Test scheduled tweet',
        media: { media_ids: ['media-1', 'media-2'] },
      })

      // Verify database was updated to mark as published
      expect(mockDb.update().set).toHaveBeenCalledWith({
        isPublished: true,
        isScheduled: false,
        twitterId: 'twitter-tweet-123',
        qstashId: null,
        updatedAt: expect.any(Date),
      })

      // Step 4: Verify the tweet is no longer in scheduled list
      mockDb.select().from().where().orderBy.mockResolvedValue([]) // No scheduled tweets

      const finalScheduledTweets = await caller.getScheduled()
      expect(finalScheduledTweets).toHaveLength(0)
    })

    it('should handle scheduling with update and cancellation', async () => {
      const context = createMockTRPCContext()
      const caller = twitterRouter.createCaller(context)
      const initialTime = Math.floor((Date.now() + 3600000) / 1000)
      const updatedTime = Math.floor((Date.now() + 7200000) / 1000)

      // Step 1: Schedule initial tweet
      const mockInitialTweet = createMockTweet({
        scheduledUnix: initialTime * 1000,
        qstashId: 'initial-qstash-123',
      })

      mockDb.insert().values().returning.mockResolvedValue([mockInitialTweet])

      await caller.schedule({
        text: 'Initial scheduled tweet',
        scheduledUnix: initialTime,
        mediaIds: [],
      })

      // Step 2: Update the scheduled tweet
      mockDb.select().from().where().limit().then.mockResolvedValue(mockInitialTweet)
      mockQstash.messages.delete.mockResolvedValue(undefined)
      mockQstash.publishJSON.mockResolvedValue({ messageId: 'updated-qstash-123' })

      const mockUpdatedTweet = createMockTweet({
        content: 'Updated scheduled tweet',
        scheduledUnix: updatedTime * 1000,
        scheduledFor: new Date(updatedTime * 1000),
        qstashId: 'updated-qstash-123',
      })

      mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedTweet])

      const updateResult = await caller.updateScheduled({
        tweetId: 'tweet-123',
        text: 'Updated scheduled tweet',
        scheduledUnix: updatedTime,
        mediaIds: [],
      })

      expect(updateResult.success).toBe(true)
      expect(mockQstash.messages.delete).toHaveBeenCalledWith('initial-qstash-123')
      expect(mockQstash.publishJSON).toHaveBeenCalledWith({
        url: 'http://localhost:3000/api/scheduled/twitter/post',
        body: { tweetId: 'tweet-123' },
        notBefore: updatedTime,
      })

      // Step 3: Cancel the scheduled tweet
      mockDb.select().from().where().limit().then.mockResolvedValue(mockUpdatedTweet)

      const cancelResult = await caller.cancelScheduled({ tweetId: 'tweet-123' })

      expect(cancelResult.success).toBe(true)
      expect(mockQstash.messages.delete).toHaveBeenCalledWith('updated-qstash-123')
      expect(mockDb.delete().where).toHaveBeenCalled()
    })

    it('should handle webhook retry scenarios', async () => {
      // Simulate QStash retrying a webhook call
      const mockTweet = createMockTweet()
      const mockAccount = createMockAccount()

      // First call - fails
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(mockAccount)
      
      mockTwitterClient.v2.tweet.mockRejectedValueOnce(new Error('Rate limit exceeded'))

      const firstRequest = new NextRequest(
        'http://localhost:3000/api/scheduled/twitter/post',
        {
          method: 'POST',
          body: JSON.stringify({ tweetId: 'tweet-123' }),
          headers: { 'Upstash-Signature': 'valid-signature' },
        }
      )

      const firstResponse = await POST(firstRequest)
      expect(firstResponse.status).toBe(500)
      expect(mockDb.update().set).not.toHaveBeenCalled()

      // Second call - succeeds
      mockDb.select().from().where().limit().then
        .mockResolvedValueOnce(mockTweet)
        .mockResolvedValueOnce(mockAccount)
      
      mockTwitterClient.v2.tweet.mockResolvedValueOnce(createMockTwitterResponse())

      const secondRequest = new NextRequest(
        'http://localhost:3000/api/scheduled/twitter/post',
        {
          method: 'POST',
          body: JSON.stringify({ tweetId: 'tweet-123' }),
          headers: { 'Upstash-Signature': 'valid-signature' },
        }
      )

      const secondResponse = await POST(secondRequest)
      expect(secondResponse.status).toBe(200)
      expect(mockDb.update().set).toHaveBeenCalledWith({
        isPublished: true,
        isScheduled: false,
        twitterId: 'twitter-tweet-123',
        qstashId: null,
        updatedAt: expect.any(Date),
      })

      // Third call - already published (idempotency)
      const publishedTweet = createMockTweet({ isPublished: true })
      mockDb.select().from().where().limit().then.mockResolvedValueOnce(publishedTweet)

      const thirdRequest = new NextRequest(
        'http://localhost:3000/api/scheduled/twitter/post',
        {
          method: 'POST',
          body: JSON.stringify({ tweetId: 'tweet-123' }),
          headers: { 'Upstash-Signature': 'valid-signature' },
        }
      )

      const thirdResponse = await POST(thirdRequest)
      expect(thirdResponse.status).toBe(200)
      expect(await thirdResponse.text()).toBe('Tweet already published')
    })

    it('should handle edge cases and error scenarios', async () => {
      const context = createMockTRPCContext()
      const caller = twitterRouter.createCaller(context)

      // Test scheduling with no connected accounts
      mockDb.select().from().where().then.mockResolvedValue([])

      await expect(
        caller.schedule({
          text: 'Test tweet',
          scheduledUnix: Math.floor((Date.now() + 3600000) / 1000),
          mediaIds: [],
        })
      ).rejects.toThrow('No connected Twitter accounts')

      // Test updating non-existent tweet
      mockDb.select().from().where().then.mockResolvedValue([createMockAccount()])
      mockDb.select().from().where().limit().then.mockResolvedValue(null)

      await expect(
        caller.updateScheduled({
          tweetId: 'nonexistent',
          text: 'Updated tweet',
          scheduledUnix: Math.floor((Date.now() + 3600000) / 1000),
          mediaIds: [],
        })
      ).rejects.toThrow('Scheduled tweet not found')

      // Test webhook with invalid signature
      mockReceiver.verify.mockRejectedValue(new Error('Invalid signature'))

      const invalidRequest = new NextRequest(
        'http://localhost:3000/api/scheduled/twitter/post',
        {
          method: 'POST',
          body: JSON.stringify({ tweetId: 'tweet-123' }),
          headers: { 'Upstash-Signature': 'invalid-signature' },
        }
      )

      const invalidResponse = await POST(invalidRequest)
      expect(invalidResponse.status).toBe(403)
    })
  })
})