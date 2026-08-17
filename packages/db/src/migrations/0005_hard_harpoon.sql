ALTER TABLE "chat_artifact" DROP CONSTRAINT IF EXISTS "chat_artifact_message_id_chat_message_id_fk";--> statement-breakpoint
ALTER TABLE "chat_artifact" DROP CONSTRAINT IF EXISTS "chat_artifact_session_id_chat_session_id_fk";--> statement-breakpoint
ALTER TABLE "chat_attachment" DROP CONSTRAINT IF EXISTS "chat_attachment_message_id_chat_message_id_fk";--> statement-breakpoint
ALTER TABLE "chat_attachment" DROP CONSTRAINT IF EXISTS "chat_attachment_session_id_chat_session_id_fk";--> statement-breakpoint
ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "chat_message_session_id_chat_session_id_fk";--> statement-breakpoint

ALTER TABLE "chat_session" ALTER COLUMN "id" SET DATA TYPE uuid USING id::uuid;--> statement-breakpoint
ALTER TABLE "chat_session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_session" ALTER COLUMN "active_leaf_id" SET DATA TYPE uuid USING active_leaf_id::uuid;--> statement-breakpoint

ALTER TABLE "chat_message" ALTER COLUMN "id" SET DATA TYPE uuid USING id::uuid;--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "session_id" SET DATA TYPE uuid USING session_id::uuid;--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "parent_id" SET DATA TYPE uuid USING parent_id::uuid;--> statement-breakpoint

ALTER TABLE "chat_artifact" ALTER COLUMN "id" SET DATA TYPE uuid USING id::uuid;--> statement-breakpoint
ALTER TABLE "chat_artifact" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_artifact" ALTER COLUMN "session_id" SET DATA TYPE uuid USING session_id::uuid;--> statement-breakpoint
ALTER TABLE "chat_artifact" ALTER COLUMN "message_id" SET DATA TYPE uuid USING message_id::uuid;--> statement-breakpoint

ALTER TABLE "chat_attachment" ALTER COLUMN "id" SET DATA TYPE uuid USING id::uuid;--> statement-breakpoint
ALTER TABLE "chat_attachment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_attachment" ALTER COLUMN "session_id" SET DATA TYPE uuid USING session_id::uuid;--> statement-breakpoint
ALTER TABLE "chat_attachment" ALTER COLUMN "message_id" SET DATA TYPE uuid USING message_id::uuid;--> statement-breakpoint

ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_artifact" ADD CONSTRAINT "chat_artifact_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_artifact" ADD CONSTRAINT "chat_artifact_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;