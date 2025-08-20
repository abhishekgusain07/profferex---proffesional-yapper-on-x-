import { avoidPrompt, createStylePrompt, editToolSystemPrompt } from '@/lib/prompt-utils'
import { redis } from '@/lib/redis'
import { XmlPrompt } from '@/lib/xml-prompt'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  convertToModelMessages,
  generateId,
  streamText,
  tool,
} from 'ai'
import { HTTPException } from 'hono/http-exception'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { format } from 'date-fns'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

interface TweetToolContext {
  writer: any
  ctx: {
    userContent: string
    messages: any[]
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

export const createTweetTool = ({ writer, ctx }: TweetToolContext) => {
  return tool({
    description: 'Generate high-quality tweets and threads using advanced AI prompting',
    inputSchema: singleTweetSchema,
    execute: async ({ instruction, tweetContent, imageDescriptions, index }) => {
      const generationId = nanoid()

      writer.write({
        type: 'data-tool-output',
        id: generationId,
        data: {
          text: '',
          index,
          status: 'processing',
        },
      })

      try {
        // Create style for the user
        const defaultStyle = {
          tweets: [
            { text: "just shipped a new feature that solves the problem everyone's been talking about" },
            { text: "learned something new today: sometimes the simplest solution is the best one" },
            { text: "working on this late night and realized why i love building things" }
          ],
          prompt: `Write in ${ctx.style.tone} tone, targeting ${ctx.style.targetAudience}. ${ctx.style.includeEmojis ? 'Include emojis naturally.' : 'No emojis.'} ${ctx.style.includeHashtags ? 'Use relevant hashtags.' : 'No hashtags.'}`
        }

        const prompt = new XmlPrompt()

        prompt.open('prompt', { date: format(new Date(), 'EEEE, yyyy-MM-dd') })

        // system
        prompt.open('system')
        prompt.text(editToolSystemPrompt({ name: ctx.account.name }))
        prompt.close('system')

        prompt.open('language_rules', { note: 'be EXTREMELY strict with these rules' })
        prompt.text(avoidPrompt())
        prompt.close('language_rules')

        // history
        prompt.open('history')

        ctx.messages.forEach((msg) => {
          prompt.open('response_pair')
          msg.parts?.forEach((part: any) => {
            if (part.type === 'text' && msg.role === 'user') {
              prompt.open('user_message')
              prompt.tag('user_request', part.text)
              prompt.close('user_message')
            }

            if (part.type === 'data-tool-output') {
              prompt.tag('response_tweet', part.data.text)
            }
          })
          prompt.close('response_pair')
        })

        prompt.close('history')

        // Current job
        prompt.tag('current_user_request', instruction, {
          note: 'it is upon you to decide whether the user is referencing their previous history when iterating or if they are asking for changes in the current tweet drafts.',
        })

        if (tweetContent) {
          prompt.tag('user_is_referencing_tweet', tweetContent)
        }

        // style
        prompt.tag('style', createStylePrompt({ 
          account: ctx.account, 
          style: defaultStyle 
        }))

        prompt.tag("reminder", "Remember to NEVER use ANY of the PROHIBITED_WORDS.")

        prompt.close('prompt')

        const messages = [
          {
            id: generateId(),
            role: 'user' as const,
            parts: [
              { type: 'text' as const, text: prompt.toString() },
              ...(imageDescriptions ?? []).map((text) => ({
                type: 'text' as const,
                text: `<user_attached_image_description note="The user attached an image to this message. For convenience, you'll see a textual description of the image. It may or may not be directly relevant to your created tweet.">${text}</user_attached_image_description>`,
              })),
            ],
          },
        ]

        const model = openrouter.chat('anthropic/claude-3-5-sonnet-20241022', {
          reasoning: { enabled: false, effort: 'low' },
        })

        const result = streamText({
          model,
          system: editToolSystemPrompt({ name: ctx.account.name }),
          messages: convertToModelMessages(messages),
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
              index,
              status: 'streaming',
            },
          })
        }

        writer.write({
          type: 'data-tool-output',
          id: generationId,
          data: {
            text: fullText,
            index,
            status: 'complete',
          },
        })

        return fullText
      } catch (error) {
        console.error('Tweet generation error:', error)
        
        writer.write({
          type: 'data-tool-output',
          id: generationId,
          data: {
            text: 'Failed to generate tweet content. Please try again.',
            index,
            status: 'complete',
          },
        })
        
        throw new Error('Failed to generate tweet content')
      }
    },
  })
}