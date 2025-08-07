import { TwitterApi } from 'twitter-api-v2'

const consumerKey = process.env.TWITTER_CONSUMER_KEY as string
const consumerSecret = process.env.TWITTER_CONSUMER_SECRET as string

if (!consumerKey || !consumerSecret) {
  // Fail fast in dev; in prod, we will guard callers and provide better errors
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('TWITTER_CONSUMER_KEY or TWITTER_CONSUMER_SECRET is not set')
  }
}

export const twitterOAuthClient = new TwitterApi({
  appKey: consumerKey,
  appSecret: consumerSecret,
})

export const twitterReadOnlyV2 = process.env.TWITTER_BEARER_TOKEN
  ? new TwitterApi(process.env.TWITTER_BEARER_TOKEN).readOnly
  : undefined 