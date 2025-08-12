const { TextEncoder, TextDecoder } = require('util')

// Polyfills required by @neondatabase/serverless in Jest
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder
}

require('@testing-library/jest-dom')

// Set test environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NODE_ENV = 'test'
process.env.FIRECRAWL_API_KEY = 'test-api-key'

// Mock superjson to avoid ES module issues
jest.mock('superjson', () => ({
  serialize: jest.fn((data) => data),
  deserialize: jest.fn((data) => data),
  default: {
    serialize: jest.fn((data) => data),
    deserialize: jest.fn((data) => data),
  },
}))

// Mock server-only
jest.mock('server-only', () => ({}))

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  cache: (fn) => fn, // Simple passthrough for cache wrapper
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
  redirect: jest.fn(),
}))

// Mock @trpc/react-query
jest.mock('@trpc/react-query', () => ({
  createTRPCReact: jest.fn(() => ({
    createClient: jest.fn(),
    Provider: ({ children }) => children,
  })),
}))

// Global console setup
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}