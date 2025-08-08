import { jest } from '@jest/globals'

// Mock environment variables for testing
process.env.QSTASH_TOKEN = 'test-qstash-token'
process.env.QSTASH_CURRENT_SIGNING_KEY = 'test-current-key'
process.env.QSTASH_NEXT_SIGNING_KEY = 'test-next-key'
process.env.TWITTER_CONSUMER_KEY = 'test-consumer-key'
process.env.TWITTER_CONSUMER_SECRET = 'test-consumer-secret'

// Mock crypto.randomUUID for consistent test results
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-123'),
  },
})

// Mock Date.now for consistent timestamps
const mockNow = new Date('2024-01-01T12:00:00Z').getTime()
jest.spyOn(Date, 'now').mockReturnValue(mockNow)

// Mock console methods to avoid cluttering test output
jest.spyOn(console, 'log').mockImplementation()
jest.spyOn(console, 'error').mockImplementation()

// Export test utilities
export const createMockTweet = (overrides = {}) => ({
  id: 'tweet-123',
  content: 'Test tweet content',
  userId: 'user-123',
  accountId: 'account-123',
  isScheduled: true,
  isPublished: false,
  scheduledFor: new Date('2024-01-01T14:00:00Z'),
  scheduledUnix: new Date('2024-01-01T14:00:00Z').getTime(),
  mediaIds: [],
  qstashId: 'qstash-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockAccount = (overrides = {}) => ({
  id: 'account-123',
  userId: 'user-123',
  providerId: 'twitter',
  accountId: 'twitter-account-123',
  accessToken: 'test-access-token',
  accessSecret: 'test-access-secret',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
})

// Mock tRPC context creator
export const createMockTRPCContext = (user = createMockUser()) => ({
  user,
  session: { user },
})

// Utility to create mock NextRequest
export const createMockRequest = (body: any, headers: Record<string, string> = {}) => {
  return {
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: {
      get: jest.fn((key: string) => headers[key] || null),
    },
  }
}

// Mock QStash response
export const createMockQStashResponse = (overrides = {}) => ({
  messageId: 'qstash-message-123',
  ...overrides,
})

// Mock Twitter API response
export const createMockTwitterResponse = (overrides = {}) => ({
  data: { id: 'twitter-tweet-123' },
  errors: undefined,
  ...overrides,
})