import { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get('chatId')

  if (!chatId) {
    return new Response(JSON.stringify({ messages: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const messages = (await redis.get(`chat:history:${chatId}`)) || []

  return new Response(JSON.stringify({ messages }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
} 