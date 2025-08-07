import { NextRequest } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { redis } from '@/lib/redis'
import { db } from '@/db'
import { account, user as userTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getBaseUrl } from '@/constants/base-url'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const oauth_token = url.searchParams.get('oauth_token')
  const oauth_verifier = url.searchParams.get('oauth_verifier')

  const redirectTo = (path: string) => Response.redirect(`${getBaseUrl()}${path}`, 302)

  if (!oauth_token || !oauth_verifier) {
    return redirectTo('/studio?error=missing_params')
  }

  try {
    const [storedSecret, userId, authAction] = await Promise.all([
      redis.get<string>(`twitter_oauth_secret:${oauth_token}`),
      redis.get<string>(`twitter_oauth_user_id:${oauth_token}`),
      redis.get<string>(`auth_action:${oauth_token}`),
    ])

    if (!storedSecret) {
      return redirectTo('/studio?error=expired_or_invalid_state')
    }

    if (!userId) {
      return redirectTo('/studio?error=missing_user')
    }

    // Validate user still exists
    const [existingUser] = await db.select().from(userTable).where(eq(userTable.id, userId))
    if (!existingUser) {
      await cleanupTemp(oauth_token)
      return redirectTo('/studio?error=user_not_found')
    }

    const consumerKey = process.env.TWITTER_CONSUMER_KEY as string
    const consumerSecret = process.env.TWITTER_CONSUMER_SECRET as string
    if (!consumerKey || !consumerSecret) {
      await cleanupTemp(oauth_token)
      return redirectTo('/studio?error=server_config')
    }

    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: oauth_token,
      accessSecret: storedSecret,
    })

    const credentials = await client.login(oauth_verifier)

    const {
      client: loggedInClient,
      accessToken,
      accessSecret,
      screenName,
      userId: twitterAccountId,
    } = credentials

    // Fetch basic profile for caching/display (best-effort)
    let profileName: string | null = null
    let profileImage: string | null = null
    try {
      const me = await loggedInClient.currentUser()
      profileName = me?.name ?? null
      // @ts-ignore - v1 typings
      profileImage = me?.profile_image_url_https ?? null
    } catch {}

    // Insert or ignore if exists (idempotent via providerId+accountId+userId combination in your logic)
    const dbAccountId = crypto.randomUUID()
    await db
      .insert(account)
      .values({
        id: dbAccountId,
        accountId: twitterAccountId,
        providerId: 'twitter',
        userId,
        accessToken,
        accessSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing?.()

    await cleanupTemp(oauth_token)

    // Redirect based on action
    const action = authAction || 'add-account'
    if (action === 'add-account') {
      return redirectTo('/studio?account_connected=true')
    }

    return redirectTo('/studio?account_connected=true')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Twitter OAuth callback error', err)
    return redirectTo('/studio?error=callback_failed')
  }
}

async function cleanupTemp(oauth_token: string) {
  await Promise.all([
    redis.del(`twitter_oauth_secret:${oauth_token}`),
    redis.del(`twitter_oauth_user_id:${oauth_token}`),
    redis.del(`auth_action:${oauth_token}`),
  ])
} 