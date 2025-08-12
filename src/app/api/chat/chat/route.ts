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

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function buildSystemPrompt(): string {
  return `You are an AI assistant specialized in helping users create engaging Twitter/X posts.
- Keep tweets under 280 characters when generating them
- Be conversational and helpful
- Ask clarifying questions when needed
- Provide multiple options when appropriate
- Be concise but informative`
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
          ? openrouter.chat('z-ai/glm-4.5-air:free')
          : openai.chat('gpt-4o-mini')

        const result = streamText({
          model,
          system: buildSystemPrompt(),
          messages: convertToModelMessages(messages as any),
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