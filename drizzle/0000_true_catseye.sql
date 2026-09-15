CREATE TYPE "public"."investment_type" AS ENUM('INVESTMENT', 'PAYMENT', 'UPAD');--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"party_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" "investment_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" text NOT NULL,
	"description" text,
	"payment_method" text,
	"reference_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labour_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"name" text NOT NULL,
	"mobile" text,
	"address" text,
	"team_id" integer,
	"work_type" text,
	"daily_rate" numeric(12, 2) DEFAULT '0',
	"tc_rate" numeric(12, 2) DEFAULT '0',
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labour_salaries" (
	"labour_id" text,
	"address" text,
	"period_from" text,
	"period_to" text,
	"work_type" text,
	"tc_quantity" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tc_rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"site_location_name" text,
	"labour_name" text NOT NULL,
	"labour_team" text,
	"attendance_type" text,
	"tc_number" text,
	"description" text,
	"days" numeric(5, 2) DEFAULT '0' NOT NULL,
	"daily_rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_earnings" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"upad" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labour_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_labour_supplies" (
	"address" text,
	"gst" text,
	"material_unit" text,
	"labour_type" text,
	"labour_quantity" numeric(12, 2) DEFAULT '0',
	"labour_unit" text,
	"material_rate" numeric(12, 2) DEFAULT '0',
	"labour_rate" numeric(12, 2) DEFAULT '0',
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"invoice_number" text,
	"notes" text,
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"site_location_name" text,
	"team_name" text,
	"material_name" text,
	"material_quantity" numeric(12, 2) DEFAULT '0',
	"party_name" text NOT NULL,
	"work_description" text NOT NULL,
	"material_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"labour_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_purchases" (
	"address" text,
	"gst" text,
	"material_category" text,
	"invoice_number" text,
	"notes" text,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"party_name" text NOT NULL,
	"material_name" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"transport_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"material_name" text NOT NULL,
	"adjustment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_supplies" (
	"address" text,
	"gst" text,
	"material_category" text,
	"invoice_number" text,
	"notes" text,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"party_name" text NOT NULL,
	"material_name" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"transport_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"default_unit" text,
	"default_rate" numeric(12, 2) DEFAULT '0',
	"min_stock" numeric(12, 2) DEFAULT '0',
	"is_active" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"gst" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" "record_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" text NOT NULL,
	"time" text,
	"party_name" text NOT NULL,
	"team_name" text,
	"description" text,
	"category" text,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"refundable_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refunded_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refund_status" text DEFAULT 'N/A' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"date" text NOT NULL,
	"team_id" integer,
	"responsible_person" text,
	"work_description" text,
	"reference_number" text,
	"notes" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"investor_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_supply_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_supply_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"reference_id" integer,
	"reference_type" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisor_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"supervisor_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"payment_method" text,
	"reference_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_parties" ADD CONSTRAINT "investment_parties_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_parties" ADD CONSTRAINT "investment_parties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_party_id_investment_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."investment_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_master" ADD CONSTRAINT "labour_master_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_master" ADD CONSTRAINT "labour_master_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_master" ADD CONSTRAINT "labour_master_team_id_labour_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."labour_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_salaries" ADD CONSTRAINT "labour_salaries_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_salaries" ADD CONSTRAINT "labour_salaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_teams" ADD CONSTRAINT "labour_teams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_teams" ADD CONSTRAINT "labour_teams_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_labour_supplies" ADD CONSTRAINT "material_labour_supplies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_labour_supplies" ADD CONSTRAINT "material_labour_supplies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock_adjustments" ADD CONSTRAINT "material_stock_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_supplies" ADD CONSTRAINT "material_supplies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_supplies" ADD CONSTRAINT "material_supplies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_supplies" ADD CONSTRAINT "site_supplies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_supplies" ADD CONSTRAINT "site_supplies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_supplies" ADD CONSTRAINT "site_supplies_team_id_labour_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."labour_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_supplies" ADD CONSTRAINT "site_supplies_investor_id_investment_parties_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investment_parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_supply_items" ADD CONSTRAINT "site_supply_items_site_supply_id_site_supplies_id_fk" FOREIGN KEY ("site_supply_id") REFERENCES "public"."site_supplies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_supply_items" ADD CONSTRAINT "site_supply_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_costs" ADD CONSTRAINT "supervisor_costs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_costs" ADD CONSTRAINT "supervisor_costs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;