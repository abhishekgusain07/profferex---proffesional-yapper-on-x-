import {
  json,
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
} from 'drizzle-orm/pg-core'
import { account, user } from './auth'
import { InferSelectModel } from 'drizzle-orm'

type Media = {
  r2Key: string // r2 (using R2 instead of S3)
  media_id: string // twitter
}

export const tweets = pgTable('tweets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text('content').default('').notNull(),
  editorState: json('editor_state').default(null),
  media: json('media').$type<Media[]>().default([]),
  mediaIds: json('media_ids').$type<string[]>().default([]),
  r2Keys: json('r2_keys').$type<string[]>().default([]),
  qstashId: text('qstash_id'),
  twitterId: text('twitter_id'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => account.id, { onDelete: 'cascade' }),
  isQueued: boolean('is_queued').default(false),
  isScheduled: boolean('is_scheduled').default(false).notNull(),
  scheduledFor: timestamp('scheduled_for'),
  scheduledUnix: bigint('scheduled_unix', { mode: 'number' }),
  isPublished: boolean('is_published').default(false).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userPublishedIdx: index('idx_tweets_user_published').on(table.userId, table.isPublished, table.createdAt),
  userScheduledIdx: index('idx_tweets_user_scheduled').on(table.userId, table.isScheduled, table.scheduledFor),
  accountPublishedIdx: index('idx_tweets_account_published').on(table.accountId, table.isPublished, table.createdAt),
  userAccountPublishedIdx: index('idx_tweets_user_account_published').on(table.userId, table.accountId, table.isPublished, table.createdAt),
  scheduledOrderIdx: index('idx_tweets_scheduled_order').on(table.isScheduled, table.scheduledFor),
  // Additional composite indexes for complex queries
  userPublishedCreatedIdx: index('idx_tweets_user_published_created').on(table.userId, table.isPublished, table.createdAt),
  accountIdPublishedIdx: index('idx_tweets_accountid_published').on(table.accountId, table.isPublished),
  userScheduledUnixIdx: index('idx_tweets_user_scheduled_unix').on(table.userId, table.isScheduled, table.scheduledUnix),
  twitterIdIdx: index('idx_tweets_twitter_id').on(table.twitterId),
}))

export type Tweet = InferSelectModel<typeof tweets>
export type TweetQuery = InferSelectModel<typeof tweets>
