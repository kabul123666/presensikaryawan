ALTER TABLE "attendances" ADD COLUMN "ditinjau_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "ditinjau_oleh" uuid;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "catatan_tinjau" text;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_ditinjau_oleh_users_id_fk" FOREIGN KEY ("ditinjau_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;