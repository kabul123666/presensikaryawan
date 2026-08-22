CREATE TABLE "period_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mulai" date NOT NULL,
	"akhir" date NOT NULL,
	"rekap" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dikunci_oleh" uuid,
	"dikunci_at" timestamp with time zone DEFAULT now() NOT NULL,
	"catatan" text,
	CONSTRAINT "period_locks_rentang_unique" UNIQUE("mulai","akhir")
);
--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_dikunci_oleh_users_id_fk" FOREIGN KEY ("dikunci_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;