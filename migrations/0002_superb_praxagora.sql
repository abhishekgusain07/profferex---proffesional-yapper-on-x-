CREATE TYPE "public"."knowledge_type" AS ENUM('url', 'txt', 'docx', 'pdf', 'image', 'manual');--> statement-breakpoint
CREATE TABLE "knowledge_document" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"type" "knowledge_type" NOT NULL,
	"s3_key" text NOT NULL,
	"title" text,
	"description" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"tags" json DEFAULT '[]'::json,
	"editor_state" json DEFAULT 'null'::json,
	"is_starred" boolean DEFAULT false NOT NULL,
	"size_bytes" integer,
	"metadata" json DEFAULT '{}'::json,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"knowledge_id" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_knowledge_id_knowledge_document_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledge_document"("id") ON DELETE cascade ON UPDATE no action;