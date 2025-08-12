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
  return `You are an AI assistant specialized in helping users create engaging Twitter/X posts.

IMPORTANT: When users request tweet creation, you MUST use the createTweetTool. This includes any request like:
- "draft a tweet"
- "write a tweet about X"
- "create a post about Y" 
- "make a tweet"
- "tweet about Z"
- "help me write something about A"
- "post about B"
- "share thoughts on C"
- "create content about D"
- Or ANY similar request for content creation

The createTweetTool will display tweets in a beautiful mockup format with an Apply button that users can use to transfer the content to their main editor.

For tweet creation requests:
1. ALWAYS use createTweetTool - never respond with plain text for tweets
2. Keep content under 280 characters
3. Make it engaging and authentic
4. Include relevant hashtags/emojis when appropriate

For non-tweet requests (general questions, explanations, etc.):
- Respond normally with helpful text
- Be conversational and informative

Remember: If someone wants to create ANY type of social media content or post, use the createTweetTool!`
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
          ? openrouter.chat('anthropic/claude-3.5-sonnet')
          : openai.chat('gpt-4o-mini')

        // Create default account and style for tweet tool
        const defaultAccount = {
          name: 'User', // TODO: Get from auth context
          username: 'user',
        }

        const defaultStyle = {
          tone: 'engaging',
          length: 'medium',
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
            createTweetTool: tweetTool,
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