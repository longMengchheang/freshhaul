-- Add driver schedules table for recurring weekly availability
create table "driver_schedules" (
	"id" uuid primary key default gen_random_uuid() not null,
	"driver_id" uuid not null references "users"("id") on delete cascade,
	"monday_from" time,
	"monday_to" time,
	"tuesday_from" time,
	"tuesday_to" time,
	"wednesday_from" time,
	"wednesday_to" time,
	"thursday_from" time,
	"thursday_to" time,
	"friday_from" time,
	"friday_to" time,
	"saturday_from" time,
	"saturday_to" time,
	"sunday_from" time,
	"sunday_to" time,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null,
	constraint "driver_schedules_driver_id_unique" unique("driver_id")
);

-- Add hot mode status to available trips
alter table "available_trips" add column "is_hot_mode_active" boolean default false not null;
alter table "available_trips" add column "hot_mode_expires_at" timestamp with time zone;
alter table "available_trips" add column "hot_mode_bonus_multiplier" numeric(3, 2) default '1.50' not null;

-- Create enum for hot mode urgency levels
create type "public"."hot_mode_urgency" as enum('normal', 'medium', 'high', 'critical');

-- Add urgency tracking to dispatch jobs
alter table "dispatch_jobs" add column "urgency" "hot_mode_urgency" default 'normal' not null;

create index "driver_schedules_driver_id_idx" on "driver_schedules"("driver_id");
create index "available_trips_hot_mode_active_idx" on "available_trips"("is_hot_mode_active");
