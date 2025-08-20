import { redis } from '@/lib/redis'
import { z } from 'zod'
import { tool, generateId } from 'ai'
import { MyUIMessage } from '../../../routers/chat'
import { format } from 'date-fns'
import { nanoid } from 'nanoid'
import { createCallerFactory } from '@trpc/server'
import { twitterRouter } from '../../twitter'
import { createTRPCContext } from '../../init'\nimport { auth } from '@/lib/auth'"}

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

// Enhanced helper to detect if instruction is asking for a thread
function isThreadRequest(instruction: string): boolean {
  const threadKeywords = [
    'thread', 'threads', 'twitter thread', 'tweet thread', 'tweetstorm',
    'series of tweets', 'multiple tweets', 'explain in detail', 'detailed explanation',
    'step by step', 'break down', 'comprehensive', 'in depth',
    'elaborate', 'expand on', 'tell me more', 'deep dive',
    'list of', 'several tweets', 'chain of tweets',
  ]
  
  const lowerInstruction = instruction.toLowerCase()
  return threadKeywords.some(keyword => lowerInstruction.includes(keyword)) ||
         (instruction.length > 200) || // Long instructions likely need threads
         /\d+\s*(tweets?|parts?)/.test(lowerInstruction) // "5 tweets about", "3 parts", etc.
}

// Enhanced helper to generate content based on instruction
function generateTweetContent(instruction: string, account: { name: string, username: string }, style: any): string {
  const isThread = isThreadRequest(instruction)
  
  // Extract topic from instruction
  const topic = instruction.toLowerCase()
    .replace(/(?:thread|tweets?)\s+about|create\s+a?\s*(?:thread|tweets?)\s+about|write\s+a?\s*(?:thread|tweets?)\s+about|make\s+a?\s*(?:thread|tweets?)\s+about/gi, '')
    .replace(/^(?:write|create|make|draft|generate)\s+/gi, '')
    .trim() || 'this topic'
  
  if (isThread) {
    // Generate enhanced thread content with better variety
    const threadStarters = [
      `🧵 Thread: ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
      `Let me share some thoughts on ${topic} (thread 🧵)`,
      `Breaking down ${topic} - a thread 🧵`,
      `${topic.charAt(0).toUpperCase() + topic.slice(1)} explained (🧵 thread)`,
    ]
    
    const starter = threadStarters[Math.floor(Math.random() * threadStarters.length)]
    
    // Generate contextual thread content
    if (topic.includes('ai') || topic.includes('artificial intelligence')) {
      return `${starter}

AI is transforming how we work and think. Here's what you need to know about the current landscape.
---
The key breakthrough isn't just in the technology itself, but in how it's becoming accessible to everyone.
---
Most people are still thinking about AI wrong. It's not about replacement - it's about augmentation.
---
The real opportunity lies in learning to work WITH AI, not competing against it. What's your take?`
    } else if (topic.includes('productivity') || topic.includes('work')) {
      return `${starter}

Productivity isn't about doing more things. It's about doing the right things more effectively.
---
The biggest productivity killer? Constant context switching. Your brain needs time to focus.
---
Here's what actually works: Time blocking, single-tasking, and ruthless prioritization.
---
Remember: Being busy ≠ Being productive. Focus on outcomes, not activities.`
    } else if (topic.includes('startup') || topic.includes('business')) {
      return `${starter}

Starting a business isn't just about having a great idea. Execution is everything.
---
The most common mistake? Building something nobody wants. Talk to your customers first.
---
Focus on solving a real problem for real people. Everything else is secondary.
---
Remember: It's better to have 100 customers who love you than 1000 who are indifferent.`
    } else {
      // Generic thread template
      return `${starter}

Let me break this down into key points that matter.
---
First, understanding the fundamentals gives you the foundation to build on.
---
Then, looking at practical applications shows you how to use this knowledge.
---
Finally, here's the key insight that ties it all together. What do you think?`
    }
  } else {
    // Generate enhanced single tweet with better variety
    const tweetStarters = [
      `Hot take on ${topic}:`,
      `Unpopular opinion about ${topic}:`,
      `Something I learned about ${topic}:`,
      `Quick thought on ${topic}:`,
      `Reality check about ${topic}:`,
    ]
    
    const starter = Math.random() > 0.7 ? tweetStarters[Math.floor(Math.random() * tweetStarters.length)] : ''
    
    const insights = [
      "This changes everything we thought we knew.",
      "The conventional wisdom is completely wrong here.", 
      "Most people are approaching this backwards.",
      "Here's why this matters more than you think.",
      "The real game-changer isn't what you'd expect."
    ]
    
    const insight = insights[Math.floor(Math.random() * insights.length)]
    const emoji = style.includeEmojis ? [' 🚀', ' 💡', ' 🔥', ' ✨', ' 🎯'][Math.floor(Math.random() * 5)] : ''
    
    return starter ? `${starter} ${insight}${emoji}` : `${insight.replace(/^./, (c) => c.toUpperCase())}${emoji}`
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
        
        // Display the generated content using the writer with enhanced data
        await writer.write({
          type: 'data-tool-output',
          id: generationId,
          data: {
            text: generatedContent,
            index: 0,
            status: 'complete',
            metadata: {
              isThread,
              tweetCount: tweets.length,
              instruction,
              shouldPost,
              accountId,
              account: ctx.account,
              tweets: tweets.map((tweet, index) => ({
                id: `generated-${generationId}-${index}`,
                text: tweet.text,
                index: index + 1,
                isConnectedBefore: index > 0,
                isConnectedAfter: index < tweets.length - 1,
              }))
            }
          }
        })

        // Enhanced posting logic with actual Twitter integration preparation
        if (shouldPost) {
          try {
            // TODO: Integrate with actual tRPC twitter.postNow when user context is available
            // This would require passing the authenticated user context through the tool
            await writer.writeText(`\n\n✅ ${isThread ? 'Thread' : 'Tweet'} generated! ${isThread ? `${tweets.length} tweets` : '1 tweet'} ready for posting.`)
            
            if (isThread) {
              await writer.writeText('\n\n🧵 Thread posting will publish all tweets in sequence with proper threading.')
            }
            
            await writer.writeText('\n\nUse the "Post Now" button to publish to your Twitter account.')
          } catch (error) {
            console.error('Posting preparation error:', error)
            await writer.writeText(`\n\n⚠️ ${isThread ? 'Thread' : 'Tweet'} generated successfully, but posting setup failed. You can try posting manually.`)
          }
        } else {
          await writer.writeText(`\n\n📝 ${isThread ? 'Thread' : 'Tweet'} generated as draft. ${isThread ? `${tweets.length} tweets` : '1 tweet'} ready for review and posting.`)
        }

        return {
          success: true,
          content: generatedContent,
          isThread,
          tweetCount: tweets.length,
          generationId,
          tweets: tweets.map((tweet, index) => ({
            id: `generated-${generationId}-${index}`,
            text: tweet.text,
            index: index + 1,
            mediaIds: [], // Future: support for media in threads
          })),
          metadata: {
            instruction,
            shouldPost,
            accountId,
            account: ctx.account,
            generatedAt: new Date().toISOString(),
          }
        }
      } catch (error) {
        console.error('Tweet generation error:', error)
        await writer.writeText('❌ Failed to generate tweet content. Please try again.')
        throw new Error('Failed to generate tweet content')
      }
    },
  })
}