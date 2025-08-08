CREATE TABLE "tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"editor_state" json DEFAULT 'null'::json,
	"media" json DEFAULT '[]'::json,
	"media_ids" json DEFAULT '[]'::json,
	"r2_keys" json DEFAULT '[]'::json,
	"qstash_id" text,
	"twitter_id" text,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"is_queued" boolean DEFAULT false,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"scheduled_for" timestamp,
	"scheduled_unix" bigint,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;