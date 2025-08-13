import { NextRequest } from 'next/server'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from 'ai'
import { redis } from '@/lib/redis'
import { createTweetTool } from '@/trpc/routers/chat/tools/create-tweet-tool'
import { createReadWebsiteContentTool } from '@/lib/read-website-content'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function buildSystemPrompt(): string {
  return `You are a powerful, agentic AI content assistant designed for creating high-quality posts for Twitter. Your responses should feel natural and genuine.

## Core Approach

1. **Conversation Style**
- Before calling a tool, ALWAYS explain what you're about to do (keep it short, 1 sentence max)
- After successfully calling the writeTweet tool, NEVER write more text. ALWAYS end your output there.
- If a user asks you to tweet, please create the first draft and avoid follow-up questions
- Use natural language and feel free to use emojis casually

2. **Tool Usage - CRITICAL**
- ALWAYS follow the tool call schema exactly as specified
- NEVER refer to tool names when speaking to the USER. Instead of saying 'I need to use the 'writeTweet' tool', just say 'I will create a tweet'
- Your ONLY task is to moderate tool calling and provide a plan (e.g. 'Let me create a tweet draft')
- NEVER write a tweet yourself, ALWAYS use the 'writeTweet' tool for ANY tweet creation

## Available Tools

**writeTweet**: Call when any tweet writing task is needed. This includes ANY request like:
- "draft a tweet" / "write a tweet about X" / "create a post about Y" 
- "make a tweet" / "tweet about Z" / "help me write something about A"
- "post about B" / "share thoughts on C" / "create content about D"
- Or ANY similar request for content creation

**readWebsiteContent**: Call to read and extract content from website URLs before creating tweets.

## Rules
- ALWAYS use writeTweet tool for tweet creation - never respond with plain text
- If user asks for multiple tweets, call writeTweet multiple times in parallel
- Read website URLs using readWebsiteContent BEFORE calling writeTweet if links are provided
- After using writeTweet, ask if they would like any improvements

Remember: If someone wants to create ANY type of social media content or post, use the writeTweet tool!`
}

// Safely extract user text from a UIMessage's parts
function extractTextFromMessage(message: UIMessage): string {
  const parts: unknown[] = (message as any).parts ?? []
  const texts: string[] = []
  for (const part of parts) {
    if (
      part &&
      typeof part === 'object' &&
      'type' in (part as any) &&
      (part as any).type === 'text' &&
      'text' in (part as any)
    ) {
      texts.push(String((part as any).text ?? ''))
    }
  }
  return texts.join('\n').trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, id } = body as { message: any; id: string }

    if (!id || !message) {
      return new Response(JSON.stringify({ message: 'Invalid request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const historyKey = `chat:history:${id}`
    const history = (await redis.get(historyKey)) as UIMessage[] | null

    // Normalize incoming message to UIMessage format if needed
    const normalizedMessage: UIMessage =
      message && typeof message === 'object' && 'parts' in message
        ? (message as UIMessage)
        : {
            role: 'user',
            id: `msg_${Date.now()}`,
            parts: [{ type: 'text', text: String(message.text ?? message.content ?? '') }],
            metadata: message.metadata,
          }

    const messages = [...(history ?? []), normalizedMessage]

    const stream = createUIMessageStream({
      originalMessages: messages,
      onFinish: async ({ messages }) => {
        await redis.set(historyKey, messages as any)
      },
      execute: async ({ writer }) => {
        const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
        const model = useOpenRouter
          ? openrouter.chat('moonshotai/kimi-k2:free')
          : openai.chat('gpt-4o')

        // Create enhanced account and style for tweet tool
        const defaultAccount = {
          name: 'User', // TODO: Get from auth context
          username: 'user',
        }

        const defaultStyle = {
          tone: 'engaging',
          length: 'short', // Keep tweets concise
          includeEmojis: true,
          includeHashtags: false,
          targetAudience: 'general',
        }

        const tweetTool = createTweetTool({
          writer,
          ctx: {
            userContent: extractTextFromMessage(normalizedMessage),
            messages,
            account: defaultAccount,
            style: defaultStyle,
          },
        })

        const readWebsiteContent = createReadWebsiteContentTool({ 
          conversationId: id 
        })

        const result = streamText({
          model,
          system: buildSystemPrompt(),
          messages: convertToModelMessages(messages as any),
          tools: {
            writeTweet: tweetTool,
            readWebsiteContent,
          },
          temperature: 0.7,
        })

        writer.merge(result.toUIMessageStream())
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ message: error?.message || 'Internal Server Error' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
} 