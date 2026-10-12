CREATE TYPE "public"."partner_role" AS ENUM('groom', 'bride');--> statement-breakpoint
CREATE TYPE "public"."payer" AS ENUM('partner1', 'partner2', 'joint', 'partner1_parents', 'partner2_parents', 'other');--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "partner1_role" "partner_role";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "partner2_role" "partner_role";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "default_payer" "payer";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "default_payer_name" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payer" "payer";--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payer_name" text;