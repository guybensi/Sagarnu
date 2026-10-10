CREATE TYPE "public"."ceremony_type" AS ENUM('religious', 'civil', 'alternative', 'other');--> statement-breakpoint
CREATE TYPE "public"."contract_source" AS ENUM('manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('quote', 'negotiating', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_style" AS ENUM('hall', 'garden', 'outdoor', 'restaurant', 'other');--> statement-breakpoint
CREATE TYPE "public"."kashrut" AS ENUM('none', 'kosher', 'mehadrin');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('credit_card', 'cash', 'bank_transfer', 'check', 'bit', 'paybox', 'other');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('fixed', 'per_guest', 'estimate');--> statement-breakpoint
CREATE TYPE "public"."relative_anchor" AS ENUM('signing', 'event');--> statement-breakpoint
CREATE TYPE "public"."event_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."schedule_source" AS ENUM('ai', 'manual', 'next_payment_prompt');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('pending', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('noon', 'evening');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('couple', 'planner');--> statement-breakpoint
CREATE TYPE "public"."vat_mode" AS ENUM('included', 'excluded', 'unknown');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"user_type" "user_type" DEFAULT 'couple' NOT NULL,
	"phone_e_164" text,
	"whatsapp_opt_in_at" timestamp with time zone,
	"default_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid,
	"key" text,
	"name_he" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_date" date,
	"event_time" time,
	"guest_count" integer,
	"estimated_budget_agorot" bigint,
	"city" text,
	"venue_name" text,
	"venue_address" text,
	"partner1_name" text,
	"partner2_name" text,
	"event_style" "event_style",
	"ceremony_type" "ceremony_type",
	"kashrut" "kashrut",
	"time_of_day" time_of_day,
	"notes" text,
	"questionnaire_completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_category_setting" (
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_relevant" boolean NOT NULL,
	CONSTRAINT "event_category_setting_event_id_category_id_pk" PRIMARY KEY("event_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "event_invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "event_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_invitation_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "event_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "event_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_member_eventId_userId_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid,
	"actor_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"status" "contract_status" NOT NULL,
	"vendor_name" text NOT NULL,
	"vendor_business_id" text,
	"vendor_contact_name" text,
	"vendor_phone" text,
	"vendor_email" text,
	"website_url" text,
	"facebook_url" text,
	"instagram_url" text,
	"contract_url" text,
	"total_amount_agorot" bigint,
	"vat_mode" "vat_mode" DEFAULT 'unknown' NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'fixed' NOT NULL,
	"per_guest_price_agorot" bigint,
	"min_guests" integer,
	"included_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"excluded_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"cancellation_policy" text,
	"notes" text,
	"signed_on" date,
	"source" "contract_source" DEFAULT 'manual' NOT NULL,
	"approved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"schedule_item_id" uuid,
	"amount_agorot" bigint NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"receipt_url" text,
	"confirmation_url" text,
	"notes" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_amount_positive" CHECK ("payment"."amount_agorot" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_schedule_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contract_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_agorot" bigint,
	"percent" double precision,
	"due_date" date,
	"relative_anchor" "relative_anchor",
	"relative_days" integer,
	"status" "schedule_status" DEFAULT 'pending' NOT NULL,
	"source" "schedule_source" DEFAULT 'manual' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"limits" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_category_setting" ADD CONSTRAINT "event_category_setting_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_category_setting" ADD CONSTRAINT "event_category_setting_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitation" ADD CONSTRAINT "event_invitation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitation" ADD CONSTRAINT "event_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_schedule_item_id_payment_schedule_item_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."payment_schedule_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedule_item" ADD CONSTRAINT "payment_schedule_item_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedule_item" ADD CONSTRAINT "payment_schedule_item_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "category_system_key_idx" ON "category" USING btree ("key") WHERE "category"."event_id" is null;--> statement-breakpoint
CREATE INDEX "category_event_id_index" ON "category" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_invitation_event_id_index" ON "event_invitation" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_member_user_id_index" ON "event_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_event_id_created_at_index" ON "audit_log" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "contract_event_id_category_id_index" ON "contract" USING btree ("event_id","category_id");--> statement-breakpoint
CREATE INDEX "payment_contract_id_index" ON "payment" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "payment_schedule_item_contract_id_index" ON "payment_schedule_item" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "payment_schedule_item_event_id_due_date_index" ON "payment_schedule_item" USING btree ("event_id","due_date");