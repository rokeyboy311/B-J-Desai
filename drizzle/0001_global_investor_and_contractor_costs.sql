-- Global Investor Architecture, Global Materials and Category 7 Contractor Costs
CREATE TABLE IF NOT EXISTS "investors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"mobile" text,
	"email" text,
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investor_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" text NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investor_location_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" text NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contractor_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"contractor_name" text NOT NULL,
	"team_id" integer,
	"team_name" text,
	"date" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"deduction_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_status" text DEFAULT 'PAID' NOT NULL,
	"work_description" text,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "location_id" DROP NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investors" ADD CONSTRAINT "investors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_transactions" ADD CONSTRAINT "investor_transactions_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_transactions" ADD CONSTRAINT "investor_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_location_allocations" ADD CONSTRAINT "investor_location_allocations_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_location_allocations" ADD CONSTRAINT "investor_location_allocations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investor_location_allocations" ADD CONSTRAINT "investor_location_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
