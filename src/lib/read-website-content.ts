import { firecrawl } from '@/lib/firecrawl'
import { redis } from '@/lib/redis'
import { tool } from 'ai'
import { z } from 'zod'

const isTwitterUrl = (url: string): boolean => {
  return /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url)
}

const extractTweetId = (url: string): string | null => {
  const match = url.match(/\/status\/(\d+)/)
  return match?.[1] ? match[1] : null
}

export const createReadWebsiteContentTool = ({ conversationId }: { conversationId: string }) =>
  tool({
    description: 'Scrape website content by URL. Use this when users share URLs and want to analyze or discuss the content.',
    parameters: z.object({ 
      website_url: z.string().url().describe('The URL of the website to scrape and analyze') 
    }),
    execute: async ({ website_url }) => {
      const cacheKey = `website-cache:${encodeURIComponent(website_url)}`

      // Check for cached content first
      const cachedContent = await redis.get(cacheKey)
      if (cachedContent) {
        await redis.lpush(`website-contents:${conversationId}`, cachedContent)
        return cachedContent as { url: string; title: string; content: string }
      }

      // Handle Twitter/X URLs differently (basic fallback without Twitter API)
      if (isTwitterUrl(website_url)) {
        const tweetId = extractTweetId(website_url)
        
        if (!tweetId) {
          throw new Error('Could not extract tweet ID from URL')
        }

        // For now, return a basic response for Twitter URLs
        // In the future, this could be enhanced with Twitter API integration
        const tweetContent = {
          url: website_url,
          title: `Tweet ${tweetId}`,
          content: `This is a Twitter/X post. You can view it at: ${website_url}`,
        }

        await redis.setex(cacheKey, 86400, tweetContent) // Cache for 24 hours
        await redis.lpush(`website-contents:${conversationId}`, tweetContent)

        return tweetContent
      }

      try {
        if (!firecrawl) {
          throw new Error('Firecrawl not configured. Please set FIRECRAWL_API_KEY.')
        }

        // Use Firecrawl to scrape the website
        const response = await firecrawl.scrapeUrl(website_url, {
          formats: ['markdown'],
        })

        if (response.success) {
          const websiteContent = {
            url: website_url,
            title: response.metadata?.title || 'Website Content',
            content: response.markdown || 'No content could be extracted from this website.',
          }

          // Cache the content for 24 hours
          await redis.setex(cacheKey, 86400, websiteContent)
          await redis.lpush(`website-contents:${conversationId}`, websiteContent)

          return websiteContent
        } else {
          throw new Error('Failed to scrape website content')
        }
      } catch (error) {
        console.error('Error scraping website:', error)
        
        const errorContent = {
          url: website_url,
          title: 'Error reading website',
          content: 'There was an error reading this website. The site might be protected against scraping or temporarily unavailable.',
        }

        await redis.lpush(`website-contents:${conversationId}`, errorContent)
        return errorContent
      }
    },
  })

export type WebsiteContent = {
  url: string
  title: string
  content: string
}