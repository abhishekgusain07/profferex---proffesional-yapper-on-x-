import { redis } from '@/lib/redis'
import { z } from 'zod'
import { tool, generateId } from 'ai'
import { MyUIMessage } from '../../../routers/chat'
import { format } from 'date-fns'
import { nanoid } from 'nanoid'

// Types for the tool context adapted for tRPC
interface TweetToolContext {
  userId: string
  userEmail: string
  tweets?: Array<{
    id: string
    content: string
    index: number
  }>
  instructions: string
  userContent: string
  messages: MyUIMessage[]
  attachments: {
    attachments: Array<{ type: string; text?: string }>
    links: Array<{ link: string }>
  }
  redisKeys: {
    thread: string
    style: string
    account: string
    websiteContent: string
  }
}

const singleTweetSchema = z.object({
  index: z
    .number()
    .describe(
      `The index of the tweet to edit. When creating a thread, using a non-existing index will create a new tweet at this index.`,
    ),
  instruction: z.string().describe(
    `Capture the user's instruction EXACTLY as they wrote it - preserve every detail including:
- Exact wording and phrasing
- Original capitalization (lowercase, UPPERCASE, Title Case)
- Punctuation and special characters
- Typos or informal language
- Numbers and formatting

DO NOT paraphrase, summarize, or clean up the instruction in any way.

<examples>
<example>
<user_message>make a tweet about AI being overhyped tbh</user_message>
<instruction>make a tweet about AI being overhyped tbh</instruction>
</example>

<example>
<user_message>make 2 tweets about why nextjs 15 is AMAZING!!!</user_message>
<instruction>tweet about why nextjs 15 is AMAZING!!!</instruction>
</example>

<example>
<user_message>write something funny about debugging at 3am</user_message>
<instruction>write something funny about debugging at 3am</instruction>
</example>

<example>
<user_message>write a thread about car engines</user_message>
<instruction>write a thread about car engines</instruction>
</example>
</examples>

Remember: This tool creates/edits ONE tweet or thread per call. If the user requests multiple drafts, frame the instruction for one specific draft only. If the user requests one thread, calling this tool once will create the entire thread.`,
  ),
  tweetContent: z
    .string()
    .optional()
    .describe(
      "Optional: If a user wants changes to a specific tweet, write that tweet's content here. Copy it EXACTLY 1:1 without ANY changes whatsoever - same casing, formatting, etc. If user is not talking about a specific previously generated tweet, leave undefined.",
    ),
  imageDescriptions: z
    .array(z.string())
    .optional()
    .default([])
    .describe(
      'Optional: If a user attached image(s), explain their content in high detail to be used as context while writing the tweet.',
    ),
})

// System prompt for tweet generation
const createTweetSystemPrompt = ({ name }: { name: string }) => `You are ${name}'s personal AI Twitter assistant. Your job is to help create engaging, authentic tweets and threads.

Guidelines:
1. Match the user's tone and style
2. Keep tweets under 280 characters
3. Make content engaging and shareable
4. Use natural language that sounds human
5. For threads, create connected tweets that flow together
6. Include relevant hashtags when appropriate
7. Don't use overly promotional language

When creating threads:
- Start with a hook in the first tweet
- Break complex ideas into digestible parts
- Use "🧵" or thread indicators when helpful
- End with a call to action or summary

Response format:
- For single tweets: Just return the tweet content
- For threads: Separate each tweet with "---"

Example thread format:
Tweet 1 content here
---
Tweet 2 content here  
---
Tweet 3 content here`

// Helper to create tweet generation prompt
function createTweetPrompt(ctx: TweetToolContext, instruction: string, tweetContent?: string, imageDescriptions?: string[]) {
  let prompt = `<prompt date="${format(new Date(), 'EEEE, yyyy-MM-dd')}">`
  
  prompt += `<system>${createTweetSystemPrompt({ name: ctx.userEmail.split('@')[0] || 'User' })}</system>`
  
  // Add history context
  prompt += '<history>'
  ctx.messages.forEach((msg) => {
    prompt += '<response_pair>'
    msg.parts.forEach((part) => {
      if (part.type === 'text' && msg.role === 'user') {
        prompt += '<user_message>'
        prompt += `<user_request>${part.text}</user_request>`
        prompt += '</user_message>'
      }
      if (part.type === 'data-tool-output') {
        prompt += `<response_tweet>${part.data?.text || ''}</response_tweet>`
      }
    })
    prompt += '</response_pair>'
  })
  prompt += '</history>'

  // Add current tweets if any
  if (ctx.tweets && ctx.tweets.length > 1) {
    prompt += '<thread_draft>'
    ctx.tweets.forEach((tweet) => {
      prompt += `<tweet_draft index="${tweet.index}">${tweet.content}</tweet_draft>`
    })
    prompt += '</thread_draft>'
  } else if (ctx.tweets && ctx.tweets.length === 1) {
    prompt += `<tweet_draft>${ctx.tweets[0]?.content || ''}</tweet_draft>`
  }

  // Add current request
  prompt += `<current_user_request>${instruction}</current_user_request>`
  
  if (tweetContent) {
    prompt += `<user_is_referencing_tweet>${tweetContent}</user_is_referencing_tweet>`
  }

  // Add image descriptions if any
  if (imageDescriptions && imageDescriptions.length > 0) {
    imageDescriptions.forEach((desc) => {
      prompt += `<user_attached_image_description>${desc}</user_attached_image_description>`
    })
  }

  prompt += '</prompt>'
  return prompt
}

export const createTweetTool = (ctx: TweetToolContext) => {
  return tool({
    description: 'Generate tweets and threads based on user instructions',
    inputSchema: singleTweetSchema,
    execute: async ({ instruction, tweetContent, imageDescriptions, index }) => {
      const generationId = nanoid()

      try {
        // For now, create a placeholder response
        // This will be enhanced with actual AI generation later
        const prompt = createTweetPrompt(ctx, instruction, tweetContent, imageDescriptions)
        
        // Simulate different types of responses based on instruction
        let generatedContent = ''
        
        if (instruction.toLowerCase().includes('thread')) {
          generatedContent = `🧵 Thread about ${instruction.toLowerCase().replace('thread about', '').trim()}

Here's the first point that sets up the main topic and hooks the reader's attention.
---
This is the second tweet that expands on the first point and provides more detail or a different perspective.
---
Final tweet that wraps up the thread with a key takeaway or call to action. What do you think?`
        } else {
          generatedContent = `Here's a tweet about ${instruction.toLowerCase().replace('tweet about', '').replace('make a tweet about', '').trim()}: 

This is engaging content that matches your request and stays under 280 characters! 🚀`
        }

        // Store in Redis for history
        await redis.lpush(ctx.redisKeys.thread, generatedContent)

        return generatedContent
      } catch (error) {
        console.error('Tweet generation error:', error)
        throw new Error('Failed to generate tweet content')
      }
    },
  })
}