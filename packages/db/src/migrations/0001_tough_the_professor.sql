CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"parent_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_session" ADD COLUMN "active_leaf_id" text;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_sessionId_idx" ON "chat_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_message_parentId_idx" ON "chat_message" USING btree ("parent_id");