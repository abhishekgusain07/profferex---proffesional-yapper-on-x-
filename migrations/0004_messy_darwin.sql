CREATE INDEX "idx_account_user_provider" ON "account" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "idx_account_user_provider_active" ON "account" USING btree ("user_id","provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_tweets_user_published" ON "tweets" USING btree ("user_id","is_published","created_at");--> statement-breakpoint
CREATE INDEX "idx_tweets_user_scheduled" ON "tweets" USING btree ("user_id","is_scheduled","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_tweets_account_published" ON "tweets" USING btree ("account_id","is_published","created_at");--> statement-breakpoint
CREATE INDEX "idx_tweets_user_account_published" ON "tweets" USING btree ("user_id","account_id","is_published","created_at");--> statement-breakpoint
CREATE INDEX "idx_tweets_scheduled_order" ON "tweets" USING btree ("is_scheduled","scheduled_for");