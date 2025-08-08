import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { TRPCError } from '@trpc/server'

// Mock dependencies
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
      where: jest.fn(() => ({
        returning: jest.fn(() => []),
      })),
    })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(),
  })),
}

jest.mock('@/lib/qstash', () => ({
  qstash: mockQstash,
}))

jest.mock('@/db', () => ({
  db: mockDb,
}))

jest.mock('@/constants/base-url', () => ({
  getBaseUrl: () => 'http://localhost:3000',
}))

// Import after mocking
import { twitterRouter } from '@/trpc/routers/twitter'
import { createTRPCContext } from '@/trpc/init'

// Mock context
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

const mockAccount = {
  id: 'account-123',
  userId: 'user-123',
  providerId: 'twitter',
  accessToken: 'token-123',
  accessSecret: 'secret-123',
}

const createMockContext = () => ({
  user: mockUser,
  session: { user: mockUser },
})

describe('Twitter Scheduling tRPC Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Setup default mocks
    mockDb.select().from().where().then.mockResolvedValue([mockAccount])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('schedule mutation', () => {
    it('should successfully schedule a tweet', async () => {
      const futureTime = Math.floor((Date.now() + 3600000) / 1000) // 1 hour from now

      // Mock QStash response
      mockQstash.publishJSON.mockResolvedValue({ messageId: 'qstash-123' })

      // Mock database insert
      const mockTweet = {
        id: 'tweet-123',
        content: 'Test tweet',
        scheduledFor: new Date(futureTime * 1000),
        accountId: 'account-123',
      }
      mockDb.insert().values().returning.mockResolvedValue([mockTweet])

      const caller = twitterRouter.createCaller(createMockContext())
      
      const result = await caller.schedule({
        text: 'Test tweet',
        scheduledUnix: futureTime,
        mediaIds: [],
      })

      expect(result).toEqual({
        success: true,
        tweetId: 'tweet-123',
        scheduledFor: mockTweet.scheduledFor,
        accountId: 'account-123',
      })

      expect(mockQstash.publishJSON).toHaveBeenCalledWith({
        url: 'http://localhost:3000/api/scheduled/twitter/post',
        body: { tweetId: 'tweet-123' },
        notBefore: futureTime,
      })
    })

    it('should reject scheduling for past time', async () => {
      const pastTime = Math.floor((Date.now() - 3600000) / 1000) // 1 hour ago

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.schedule({
          text: 'Test tweet',
          scheduledUnix: pastTime,
          mediaIds: [],
        })
      ).rejects.toThrow('Schedule time must be at least 1 minute in the future')
    })

    it('should reject scheduling too far in future', async () => {
      const farFutureTime = Math.floor((Date.now() + 400 * 24 * 60 * 60 * 1000) / 1000) // 400 days

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.schedule({
          text: 'Test tweet',
          scheduledUnix: farFutureTime,
          mediaIds: [],
        })
      ).rejects.toThrow('Schedule time cannot be more than 1 year in the future')
    })

    it('should reject empty tweet text', async () => {
      const futureTime = Math.floor((Date.now() + 3600000) / 1000)

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.schedule({
          text: '',
          scheduledUnix: futureTime,
          mediaIds: [],
        })
      ).rejects.toThrow('Tweet cannot be empty')
    })

    it('should reject tweet text over 280 characters', async () => {
      const futureTime = Math.floor((Date.now() + 3600000) / 1000)
      const longText = 'a'.repeat(281)

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.schedule({
          text: longText,
          scheduledUnix: futureTime,
          mediaIds: [],
        })
      ).rejects.toThrow('Tweet exceeds 280 characters')
    })

    it('should handle QStash failure and cleanup', async () => {
      const futureTime = Math.floor((Date.now() + 3600000) / 1000)

      // Mock QStash success
      mockQstash.publishJSON.mockResolvedValue({ messageId: 'qstash-123' })
      
      // Mock database failure
      mockDb.insert().values().returning.mockResolvedValue([])

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.schedule({
          text: 'Test tweet',
          scheduledUnix: futureTime,
          mediaIds: [],
        })
      ).rejects.toThrow('Failed to schedule tweet')

      // Should attempt cleanup
      expect(mockQstash.messages.delete).toHaveBeenCalledWith('qstash-123')
    })
  })

  describe('getScheduled query', () => {
    it('should return scheduled tweets', async () => {
      const mockTweets = [
        {
          id: 'tweet-1',
          content: 'First tweet',
          scheduledFor: new Date(),
          scheduledUnix: Date.now(),
          mediaIds: [],
          accountId: 'account-123',
          createdAt: new Date(),
        },
        {
          id: 'tweet-2',
          content: 'Second tweet',
          scheduledFor: new Date(),
          scheduledUnix: Date.now() + 3600000,
          mediaIds: ['media-1'],
          accountId: 'account-123',
          createdAt: new Date(),
        },
      ]

      // Mock database select for scheduled tweets
      mockDb.select().from().where().orderBy.mockResolvedValue(mockTweets)

      const caller = twitterRouter.createCaller(createMockContext())
      const result = await caller.getScheduled()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'tweet-1',
        content: 'First tweet',
        scheduledFor: mockTweets[0].scheduledFor,
        scheduledUnix: mockTweets[0].scheduledUnix,
        mediaIds: [],
        accountId: 'account-123',
        createdAt: mockTweets[0].createdAt,
      })
    })

    it('should handle no connected accounts', async () => {
      // Mock no accounts
      mockDb.select().from().where().then.mockResolvedValue([])

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(caller.getScheduled()).rejects.toThrow('No connected Twitter accounts')
    })
  })

  describe('cancelScheduled mutation', () => {
    it('should successfully cancel scheduled tweet', async () => {
      const mockTweet = {
        id: 'tweet-123',
        qstashId: 'qstash-123',
        userId: 'user-123',
        isScheduled: true,
        isPublished: false,
      }

      // Mock finding the tweet
      mockDb.select().from().where().limit().then.mockResolvedValue(mockTweet)
      
      // Mock QStash delete success
      mockQstash.messages.delete.mockResolvedValue(undefined)

      const caller = twitterRouter.createCaller(createMockContext())
      const result = await caller.cancelScheduled({ tweetId: 'tweet-123' })

      expect(result).toEqual({
        success: true,
        tweetId: 'tweet-123',
      })

      expect(mockQstash.messages.delete).toHaveBeenCalledWith('qstash-123')
      expect(mockDb.delete().where).toHaveBeenCalled()
    })

    it('should handle tweet not found', async () => {
      // Mock tweet not found
      mockDb.select().from().where().limit().then.mockResolvedValue(null)

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.cancelScheduled({ tweetId: 'nonexistent' })
      ).rejects.toThrow('Scheduled tweet not found')
    })

    it('should handle QStash delete failure', async () => {
      const mockTweet = {
        id: 'tweet-123',
        qstashId: 'qstash-123',
        userId: 'user-123',
        isScheduled: true,
        isPublished: false,
      }

      mockDb.select().from().where().limit().then.mockResolvedValue(mockTweet)
      mockQstash.messages.delete.mockRejectedValue(new Error('QStash error'))

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.cancelScheduled({ tweetId: 'tweet-123' })
      ).rejects.toThrow('Failed to cancel scheduled tweet')
    })
  })

  describe('updateScheduled mutation', () => {
    it('should successfully update scheduled tweet', async () => {
      const newTime = Math.floor((Date.now() + 7200000) / 1000) // 2 hours from now
      
      const mockExistingTweet = {
        id: 'tweet-123',
        qstashId: 'old-qstash-123',
        userId: 'user-123',
        isScheduled: true,
        isPublished: false,
      }

      const mockUpdatedTweet = {
        id: 'tweet-123',
        content: 'Updated tweet',
        scheduledFor: new Date(newTime * 1000),
        accountId: 'account-123',
      }

      // Mock finding existing tweet
      mockDb.select().from().where().limit().then.mockResolvedValue(mockExistingTweet)
      
      // Mock QStash operations
      mockQstash.messages.delete.mockResolvedValue(undefined)
      mockQstash.publishJSON.mockResolvedValue({ messageId: 'new-qstash-123' })
      
      // Mock database update
      mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedTweet])

      const caller = twitterRouter.createCaller(createMockContext())
      const result = await caller.updateScheduled({
        tweetId: 'tweet-123',
        text: 'Updated tweet',
        scheduledUnix: newTime,
        mediaIds: [],
      })

      expect(result).toEqual({
        success: true,
        tweetId: 'tweet-123',
        scheduledFor: mockUpdatedTweet.scheduledFor,
        accountId: 'account-123',
      })

      // Should cancel old job and create new one
      expect(mockQstash.messages.delete).toHaveBeenCalledWith('old-qstash-123')
      expect(mockQstash.publishJSON).toHaveBeenCalledWith({
        url: 'http://localhost:3000/api/scheduled/twitter/post',
        body: { tweetId: 'tweet-123' },
        notBefore: newTime,
      })
    })

    it('should handle database update failure with cleanup', async () => {
      const newTime = Math.floor((Date.now() + 7200000) / 1000)
      
      const mockExistingTweet = {
        id: 'tweet-123',
        qstashId: 'old-qstash-123',
        userId: 'user-123',
        isScheduled: true,
        isPublished: false,
      }

      mockDb.select().from().where().limit().then.mockResolvedValue(mockExistingTweet)
      mockQstash.messages.delete.mockResolvedValue(undefined)
      mockQstash.publishJSON.mockResolvedValue({ messageId: 'new-qstash-123' })
      
      // Mock database update failure
      mockDb.update().set().where().returning.mockResolvedValue([])

      const caller = twitterRouter.createCaller(createMockContext())

      await expect(
        caller.updateScheduled({
          tweetId: 'tweet-123',
          text: 'Updated tweet',
          scheduledUnix: newTime,
          mediaIds: [],
        })
      ).rejects.toThrow('Failed to update scheduled tweet')

      // Should cleanup new QStash job
      expect(mockQstash.messages.delete).toHaveBeenCalledWith('new-qstash-123')
    })
  })
})