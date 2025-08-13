import { createStylePrompt, editToolSystemPrompt } from '@/lib/prompt-utils'
import { XmlPrompt } from '@/lib/xml-prompt'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  convertToModelMessages,
  generateId,
  streamText,
  tool,
  UIMessage,
  UIMessageStreamWriter,
} from 'ai'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { format } from 'date-fns'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

interface MessagePart {
  type: string
  text?: string
  data?: {
    text: string
    status: string
  }
}

export interface MyUIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: MessagePart[]
  content?: string
}

interface Context {
  writer: UIMessageStreamWriter
  ctx: {
    userContent: string
    messages: MyUIMessage[]
    account: {
      name: string
      username?: string
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

export const createTweetTool = ({ writer, ctx }: Context) => {
  return tool({
    description: 'Creates a tweet based on user instruction',
    inputSchema: z.object({
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
    </examples>
    
    Remember: This tool creates/edits ONE tweet per call. If the user requests multiple drafts, frame the instruction for one specific draft only.`,
      ),
      tweetContent: z
        .string()
        .optional()
        .describe(
          "Optional: If a user wants changes to a specific tweet, write that tweet's content here. Copy it EXACTLY 1:1 without ANY changes whatsoever - same casing, formatting, etc. If user is not talking about a specific previously generated tweet, leave undefined.",
        ),
    }),
    execute: async ({ instruction, tweetContent }) => {
      const generationId = nanoid()

      writer.write({
        type: 'data-tool-output',
        id: generationId,
        data: {
          text: '',
          status: 'processing',
        },
      })

      const prompt = new XmlPrompt()

      prompt.open('prompt', { date: format(new Date(), 'EEEE, yyyy-MM-dd') })

      // system
      prompt.open('system')
      prompt.text(editToolSystemPrompt({ name: ctx.account.name }))
      prompt.close('system')

      // history
      prompt.open('history')

      ctx.messages.forEach((msg) => {
        prompt.open('response_pair')
        msg.parts.forEach((part) => {
          if (part.type === 'text' && msg.role === 'user' && part.text) {
            prompt.open('user_message')
            prompt.tag('user_request', part.text)
            prompt.close('user_message')
          }

          if (part.type === 'data-tool-output' && part.data?.text) {
            prompt.tag('response_tweet', part.data.text)
          }
        })
        prompt.close('response_pair')
      })

      prompt.close('history')

      // current job
      prompt.tag('current_user_request', instruction ?? ctx.userContent)

      if (tweetContent) {
        prompt.tag('user_is_referencing_tweet', tweetContent)
      }

      // style
      prompt.tag('style', createStylePrompt({ account: ctx.account, style: ctx.style as any }))

      prompt.close('prompt')

      const messages: UIMessage[] = [
        {
          id: generateId(),
          role: 'user',
          parts: [{ type: 'text', text: prompt.toString() }],
        },
      ]

      let modelToUse = 'moonshotai/kimi-k2:free'
      if (process.env.OPENROUTER_API_KEY) {
        modelToUse = 'moonshotai/kimi-k2:free'
      } else if (process.env.OPENAI_API_KEY) {
        modelToUse = 'gpt-4o-mini'
      }

      const result = streamText({
        model: openrouter.chat(modelToUse),
        system: editToolSystemPrompt({ name: ctx.account.name }),
        messages: convertToModelMessages(
          messages),
        onError(error) {
          console.log('❌❌❌ ERROR:', JSON.stringify(error, null, 2))

          throw new HTTPException(500, {
            message: error instanceof Error ? error.message : 'Something went wrong.',
          })
        },
      })

      let fullText = ''

      for await (const textPart of result.textStream) {
        fullText += textPart
        writer.write({
          type: 'data-tool-output',
          id: generationId,
          data: {
            text: fullText,
            status: 'streaming',
          },
        })
      }

      writer.write({
        type: 'data-tool-output',
        id: generationId,
        data: {
          text: fullText,
          status: 'complete',
        },
      })

      return fullText
    },
  })
}