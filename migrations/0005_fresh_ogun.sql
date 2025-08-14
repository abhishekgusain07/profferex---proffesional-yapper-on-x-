CREATE INDEX "idx_tweets_user_published_created" ON "tweets" USING btree ("user_id","is_published","created_at");--> statement-breakpoint
CREATE INDEX "idx_tweets_accountid_published" ON "tweets" USING btree ("account_id","is_published");--> statement-breakpoint
CREATE INDEX "idx_tweets_user_scheduled_unix" ON "tweets" USING btree ("user_id","is_scheduled","scheduled_unix");--> statement-breakpoint
CREATE INDEX "idx_tweets_twitter_id" ON "tweets" USING btree ("twitter_id");