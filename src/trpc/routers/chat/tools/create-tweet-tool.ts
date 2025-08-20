import { redis } from '@/lib/redis'
import { z } from 'zod'
import { tool, generateId } from 'ai'
import { MyUIMessage } from '../../../routers/chat'
import { format } from 'date-fns'
import { nanoid } from 'nanoid'
import { createCallerFactory } from '@trpc/server'
import { twitterRouter } from '../../twitter'
import { createTRPCContext } from '../../init'

// Types for the tool context adapted for tRPC
interface TweetToolContext {
  writer: any
  ctx: {
    userContent: string
    messages: MyUIMessage[]
    account: {
      name: string
      username: string
    }
    style: {
      tone: string
      length: string
      includeEmojis: boolean
      includeHashtags: boolean
      targetAudience: string
    }
  }
}

const tweetToolSchema = z.object({
  instruction: z.string().describe(
    'The user instruction for creating tweets or threads. Examples: "write a thread about AI", "create a tweet about productivity", etc.'
  ),
  shouldPost: z.boolean().default(true).describe(
    'Whether to immediately post the generated content to Twitter or just generate it as a draft.'
  ),
  accountId: z.string().optional().describe(
    'Optional specific Twitter account ID to use for posting. If not provided, will use the active account.'
  ),
})

// Helper to detect if instruction is asking for a thread
function isThreadRequest(instruction: string): boolean {
  const threadKeywords = [
    'thread', 'threads', 'twitter thread', 'tweet thread',
    'series of tweets', 'multiple tweets', 'explain in detail',
    'step by step', 'break down', 'comprehensive',
  ]
  
  const lowerInstruction = instruction.toLowerCase()
  return threadKeywords.some(keyword => lowerInstruction.includes(keyword))
}

// Helper to generate content based on instruction
function generateTweetContent(instruction: string, account: { name: string, username: string }, style: any): string {
  const isThread = isThreadRequest(instruction)
  
  if (isThread) {
    // Generate thread content
    const topic = instruction.toLowerCase()
      .replace(/thread about|create a thread about|write a thread about|make a thread about/gi, '')
      .trim()
    
    return `🧵 Thread: ${topic.charAt(0).toUpperCase() + topic.slice(1)}

Let me break this down for you in a comprehensive way that covers all the key aspects.
---
First, it's important to understand the fundamentals and why this topic matters in today's context.
---
Building on that foundation, here are the practical implications and what you need to know.
---
Finally, here's my key takeaway and what I recommend you do next. What are your thoughts?`
  } else {
    // Generate single tweet
    const topic = instruction.toLowerCase()
      .replace(/tweet about|create a tweet about|write a tweet about|make a tweet about/gi, '')
      .trim()
    
    return `Interesting perspective on ${topic}! Here's what I think: this is exactly the kind of insight that makes you reconsider your approach. ${style.includeEmojis ? '🚀' : ''}`
  }
}

// Helper to parse thread content into individual tweets
function parseThreadContent(content: string): { isThread: boolean; tweets: Array<{ text: string }> } {
  if (!content.includes('---')) {
    return { isThread: false, tweets: [{ text: content.trim() }] }
  }
  
  const tweetTexts = content.split('---').map(tweet => tweet.trim()).filter(tweet => tweet.length > 0)
  return {
    isThread: true,
    tweets: tweetTexts.map(text => ({ text }))
  }
}

export const createTweetTool = ({ writer, ctx }: TweetToolContext) => {
  return tool({
    description: 'Generate and optionally post tweets or threads to Twitter based on user instructions',
    inputSchema: tweetToolSchema,
    execute: async ({ instruction, shouldPost, accountId }) => {
      const generationId = nanoid()

      try {
        // Generate content based on instruction
        const generatedContent = generateTweetContent(instruction, ctx.account, ctx.style)
        
        // Parse content to determine if it's a thread
        const { isThread, tweets } = parseThreadContent(generatedContent)
        
        // Display the generated content using the writer
        await writer.writeData({
          type: 'tweet-mockup',
          isThread,
          tweets: tweets.map((tweet, index) => ({
            id: `generated-${generationId}-${index}`,
            text: tweet.text,
            index: index + 1,
            isConnectedBefore: index > 0,
            isConnectedAfter: index < tweets.length - 1,
          })),
          metadata: {
            instruction,
            shouldPost,
            accountId,
            account: ctx.account,
          }
        })

        // If shouldPost is true, attempt to post to Twitter
        if (shouldPost) {
          try {
            // We need access to the tRPC context and session to post
            // For now, just indicate that posting would happen here
            await writer.writeText('\n\n✅ Generated content ready for posting! Use the "Post Now" button to publish to Twitter.')
          } catch (error) {
            console.error('Posting error:', error)
            await writer.writeText('\n\n⚠️ Generated content successfully, but posting failed. You can try posting manually.')
          }
        } else {
          await writer.writeText('\n\n📝 Content generated as draft. You can review and post it when ready.')
        }

        return {
          success: true,
          content: generatedContent,
          isThread,
          tweetCount: tweets.length,
          generationId,
        }
      } catch (error) {
        console.error('Tweet generation error:', error)
        await writer.writeText('❌ Failed to generate tweet content. Please try again.')
        throw new Error('Failed to generate tweet content')
      }
    },
  })
}