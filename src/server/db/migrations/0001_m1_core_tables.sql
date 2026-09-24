CREATE TYPE "public"."dish_status" AS ENUM('draft', 'planned', 'eaten', 'not_eaten');--> statement-breakpoint
CREATE TYPE "public"."meal_slot" AS ENUM('breakfast', 'lunch', 'dinner');--> statement-breakpoint
CREATE TYPE "public"."pantry_quantity" AS ENUM('plenty', 'some', 'low');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('draft', 'planned', 'cooked', 'skipped', 'ate_out');--> statement-breakpoint
CREATE TYPE "public"."taste_fact_source" AS ENUM('stated', 'choice');--> statement-breakpoint
CREATE TYPE "public"."taste_fact_type" AS ENUM('preference', 'restriction', 'routine');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_dishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"meal_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"recipe_id" uuid,
	"dish_name" text,
	"features" jsonb,
	"status" "dish_status" NOT NULL,
	"rating" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_dishes_rating_check" CHECK ("meal_dishes"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"status" "slot_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meals_user_id_date_slot_unique" UNIQUE("user_id","date","slot")
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ingredient_key" text,
	"raw_name" text NOT NULL,
	"quantity" "pantry_quantity",
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"features" jsonb,
	"source" text NOT NULL,
	"source_ref" text NOT NULL,
	"license" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_source_source_ref_unique" UNIQUE("source","source_ref")
);
--> statement-breakpoint
CREATE TABLE "taste_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "taste_fact_type" NOT NULL,
	"content" text NOT NULL,
	"payload" jsonb,
	"source" "taste_fact_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"week_starts_on" smallint DEFAULT 1 NOT NULL,
	"household_size" smallint,
	"dishes_per_meal" smallint,
	"dedupe_window_days" smallint DEFAULT 14 NOT NULL,
	"taste_summary" text,
	"taste_summary_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_week_starts_on_check" CHECK ("users"."week_starts_on" in (0, 1)),
	CONSTRAINT "users_household_size_check" CHECK ("users"."household_size" >= 1),
	CONSTRAINT "users_dishes_per_meal_check" CHECK ("users"."dishes_per_meal" >= 1),
	CONSTRAINT "users_dedupe_window_days_check" CHECK ("users"."dedupe_window_days" >= 0)
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_dishes" ADD CONSTRAINT "meal_dishes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_dishes" ADD CONSTRAINT "meal_dishes_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_dishes" ADD CONSTRAINT "meal_dishes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_facts" ADD CONSTRAINT "taste_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_user_id_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_user_id_created_at_idx" ON "events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "meal_dishes_user_id_idx" ON "meal_dishes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meal_dishes_meal_id_idx" ON "meal_dishes" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "pantry_items_user_id_idx" ON "pantry_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipes_owner_id_idx" ON "recipes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "taste_facts_user_id_type_idx" ON "taste_facts" USING btree ("user_id","type");