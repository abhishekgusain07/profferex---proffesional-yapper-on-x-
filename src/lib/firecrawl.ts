import FirecrawlApp from '@mendable/firecrawl-js'

export const firecrawl = process.env.FIRECRAWL_API_KEY 
  ? new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY,
    })
  : null