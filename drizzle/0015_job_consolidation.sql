-- Add job consolidation support
-- Tracks bundles of jobs that can be combined into single trips

create type "public"."consolidation_status" as enum('suggested', 'accepted', 'rejected', 'completed', 'cancelled');

create table "job_consolidations" (
	"id" uuid primary key default gen_random_uuid() not null,
	"driver_id" uuid not null references "users"("id") on delete cascade,
	"primary_deal_id" uuid not null references "deals"("id") on delete cascade,
	"consolidated_deal_ids" uuid[] not null,
	"status" "consolidation_status" default 'suggested' not null,
	"estimated_time_saved_minutes" integer,
	"earnings_increment_usd" numeric(10, 2),
	"efficiency_score" numeric(5, 2),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null,
	constraint "consolidation_at_least_2_deals" check (array_length("consolidated_deal_ids", 1) >= 1)
);

-- Track multi-stop execution progress
create table "consolidation_executions" (
	"id" uuid primary key default gen_random_uuid() not null,
	"consolidation_id" uuid not null references "job_consolidations"("id") on delete cascade,
	"deal_id" uuid not null references "deals"("id") on delete cascade,
	"sequence_order" integer not null,
	"status" varchar not null default 'pending', -- pending, in_progress, completed, skipped
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone default now() not null
);

create index "job_consolidations_driver_id_idx" on "job_consolidations"("driver_id");
create index "job_consolidations_primary_deal_id_idx" on "job_consolidations"("primary_deal_id");
create index "job_consolidations_status_idx" on "job_consolidations"("status");
create index "consolidation_executions_consolidation_id_idx" on "consolidation_executions"("consolidation_id");
