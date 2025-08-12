export interface StyleConfig {
  tone: 'casual' | 'professional' | 'witty' | 'informative' | 'engaging'
  length: 'short' | 'medium' | 'long'
  includeEmojis: boolean
  includeHashtags: boolean
  targetAudience: string
}

export interface AccountConfig {
  name: string
  username?: string
  bio?: string
  industry?: string
  expertise?: string[]
}

export const createStylePrompt = ({
  account,
  style,
}: {
  account: AccountConfig
  style: StyleConfig
}) => {
  return `
Writing Style Guidelines:
- Tone: ${style.tone}
- Length: ${style.length}
- Emojis: ${style.includeEmojis ? 'Include relevant emojis' : 'No emojis'}
- Hashtags: ${style.includeHashtags ? 'Include 1-3 relevant hashtags' : 'No hashtags'}
- Target Audience: ${style.targetAudience}

Account Context:
- Name: ${account.name}
- Username: ${account.username || 'N/A'}
- Bio: ${account.bio || 'N/A'}
- Industry: ${account.industry || 'N/A'}
- Expertise: ${account.expertise?.join(', ') || 'N/A'}

Write tweets that reflect this person's voice and expertise while following the style guidelines.
`.trim()
}

export const editToolSystemPrompt = ({ name }: { name: string }) => {
  return `You are an expert social media content creator helping ${name} create engaging Twitter content.

Your role:
1. Analyze the user's request and context
2. Create compelling tweets that match their voice and goals
3. Ensure content is engaging, authentic, and platform-appropriate
4. Follow Twitter best practices (character limits, engagement tactics)
5. Incorporate relevant context from attached documents when available

Guidelines:
- Keep tweets under 280 characters
- Make content engaging and shareable
- Use natural, conversational language
- Include relevant emojis when appropriate
- Add strategic hashtags for discoverability
- Consider the user's brand and expertise
- Ensure content is original and valuable

When creating tweets:
- Start with a hook to grab attention
- Provide value (insight, tip, question, or entertainment)
- End with a call-to-action when appropriate
- Use line breaks for readability
- Consider thread potential for longer topics

Respond with just the tweet content, formatted and ready to post.`
}

export const createTweetPrompt = ({
  instruction,
  userContent,
  editorContent,
  account,
  style,
  attachments = [],
}: {
  instruction: string
  userContent?: string
  editorContent?: string
  account: AccountConfig
  style: StyleConfig
  attachments?: Array<{ title: string; content?: string; type: string }>
}) => {
  let prompt = `Create a tweet based on this instruction: "${instruction}"`

  if (userContent) {
    prompt += `\n\nUser's message: ${userContent}`
  }

  if (editorContent) {
    prompt += `\n\nCurrent draft: ${editorContent}`
  }

  if (attachments.length > 0) {
    prompt += `\n\nAttached context:`
    attachments.forEach((attachment, i) => {
      prompt += `\n${i + 1}. ${attachment.title} (${attachment.type})`
      if (attachment.content) {
        prompt += `\n   Content: ${attachment.content.slice(0, 500)}${attachment.content.length > 500 ? '...' : ''}`
      }
    })
  }

  prompt += `\n\n${createStylePrompt({ account, style })}`

  return prompt
}

export const extractTweetFromResponse = (response: string): string => {
  // Try to extract clean tweet content from AI response
  const patterns = [
    // Look for quoted content
    /"([^"]{1,280})"/,
    // Look for content after "Tweet:" or similar
    /(?:tweet|post|content):\s*["']?([^"'\n]{1,280})["']?/i,
    // Look for standalone content without markers
    /^([^.\n]{10,280})$/m,
  ]

  for (const pattern of patterns) {
    const match = response.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  // If no pattern matches, take first 280 chars and clean up
  return response
    .split('\n')
    .find(line => line.trim().length > 10)
    ?.slice(0, 280)
    ?.trim() || response.slice(0, 280).trim()
}

export const validateTweet = (content: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!content.trim()) {
    errors.push('Tweet cannot be empty')
  }

  if (content.length > 280) {
    errors.push(`Tweet is ${content.length - 280} characters too long`)
  }

  if (content.length < 10) {
    errors.push('Tweet is too short to be engaging')
  }

  // Check for excessive hashtags
  const hashtagCount = (content.match(/#\w+/g) || []).length
  if (hashtagCount > 5) {
    errors.push('Too many hashtags (max 5 recommended)')
  }

  // Check for excessive mentions
  const mentionCount = (content.match(/@\w+/g) || []).length
  if (mentionCount > 3) {
    errors.push('Too many mentions (max 3 recommended)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}