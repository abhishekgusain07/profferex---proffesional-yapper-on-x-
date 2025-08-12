import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Mock dependencies before importing
jest.mock('@/lib/firecrawl', () => ({
  firecrawl: {
    scrapeUrl: jest.fn(),
  },
}))

jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    lpush: jest.fn(),
  },
}))

// Mock @mendable/firecrawl-js to prevent initialization issues
jest.mock('@mendable/firecrawl-js', () => {
  return jest.fn().mockImplementation(() => ({
    scrapeUrl: jest.fn(),
  }))
})

import { createReadWebsiteContentTool } from '@/lib/read-website-content'

const { firecrawl } = require('@/lib/firecrawl')
const { redis } = require('@/lib/redis')

describe('Website Content Reading', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createReadWebsiteContentTool', () => {
    it('should create a tool with correct configuration', () => {
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      
      expect(tool).toBeDefined()
      expect(tool.description).toContain('Scrape website content by URL')
    })

    it('should handle cached content', async () => {
      const cachedContent = {
        url: 'https://example.com',
        title: 'Test Page',
        content: 'Cached content'
      }
      
      redis.get.mockResolvedValue(cachedContent)
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'https://example.com' })
      
      expect(result).toEqual(cachedContent)
      expect(redis.lpush).toHaveBeenCalledWith('website-contents:test-conv-id', cachedContent)
    })

    it('should handle Twitter URLs', async () => {
      redis.get.mockResolvedValue(null)
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'https://twitter.com/user/status/123456789' })
      
      expect(result.url).toBe('https://twitter.com/user/status/123456789')
      expect(result.title).toBe('Tweet 123456789')
      expect(result.content).toContain('This is a Twitter/X post')
      expect(redis.setex).toHaveBeenCalled()
      expect(redis.lpush).toHaveBeenCalled()
    })

    it('should handle successful website scraping', async () => {
      redis.get.mockResolvedValue(null)
      firecrawl.scrapeUrl.mockResolvedValue({
        success: true,
        metadata: { title: 'Test Website' },
        markdown: 'This is the scraped content'
      })
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'https://example.com' })
      
      expect(result.url).toBe('https://example.com')
      expect(result.title).toBe('Test Website')
      expect(result.content).toBe('This is the scraped content')
      expect(firecrawl.scrapeUrl).toHaveBeenCalledWith('https://example.com', {
        formats: ['markdown']
      })
      expect(redis.setex).toHaveBeenCalled()
      expect(redis.lpush).toHaveBeenCalled()
    })

    it('should handle scraping errors', async () => {
      redis.get.mockResolvedValue(null)
      firecrawl.scrapeUrl.mockResolvedValue({
        success: false
      })
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'https://example.com' })
      
      expect(result.url).toBe('https://example.com')
      expect(result.title).toBe('Error reading website')
      expect(result.content).toContain('There was an error reading this website')
      expect(redis.lpush).toHaveBeenCalled()
    })

    it('should handle invalid Twitter URLs', async () => {
      redis.get.mockResolvedValue(null)
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      
      await expect(
        tool.execute({ website_url: 'https://twitter.com/invalid-url' })
      ).rejects.toThrow('Could not extract tweet ID from URL')
    })

    it('should handle network errors', async () => {
      redis.get.mockResolvedValue(null)
      firecrawl.scrapeUrl.mockRejectedValue(new Error('Network error'))
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'https://example.com' })
      
      expect(result.title).toBe('Error reading website')
      expect(result.content).toContain('There was an error reading this website')
    })
  })

  describe('URL validation', () => {
    it('should accept valid HTTP URLs', async () => {
      redis.get.mockResolvedValue(null)
      firecrawl.scrapeUrl.mockResolvedValue({
        success: true,
        metadata: { title: 'Test' },
        markdown: 'Content'
      })
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'http://example.com' })
      
      expect(result.url).toBe('http://example.com')
    })

    it('should accept valid HTTPS URLs', async () => {
      redis.get.mockResolvedValue(null)
      firecrawl.scrapeUrl.mockResolvedValue({
        success: true,
        metadata: { title: 'Test' },
        markdown: 'Content'
      })
      
      const tool = createReadWebsiteContentTool({ conversationId: 'test-conv-id' })
      const result = await tool.execute({ website_url: 'https://example.com' })
      
      expect(result.url).toBe('https://example.com')
    })
  })
})