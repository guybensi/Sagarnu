ALTER TYPE "public"."event_style" ADD VALUE 'home' BEFORE 'restaurant';--> statement-breakpoint
ALTER TYPE "public"."event_style" ADD VALUE 'festival' BEFORE 'restaurant';--> statement-breakpoint
CREATE TABLE "event_cover_photo" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "cover_photo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_cover_photo" ADD CONSTRAINT "event_cover_photo_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_cover_photo" ADD CONSTRAINT "event_cover_photo_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;