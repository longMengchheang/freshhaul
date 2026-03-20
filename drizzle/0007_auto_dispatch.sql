create type "public"."dispatch_job_status" as enum('queued', 'seen', 'claimed', 'expired', 'cancelled');
--> statement-breakpoint
create type "public"."dispatch_event_type" as enum('deal_queued', 'driver_notified', 'driver_claimed', 'dispatch_expired', 'no_driver_available');
--> statement-breakpoint
create table "dispatch_jobs" (
	"id" uuid primary key default gen_random_uuid() not null,
	"deal_id" uuid not null,
	"driver_id" uuid not null,
	"trip_id" uuid not null,
	"score" numeric(6, 2) default '0.00' not null,
	"priority_rank" integer not null,
	"status" "dispatch_job_status" default 'queued' not null,
	"expires_at" timestamp with time zone not null,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null,
	constraint "dispatch_jobs_deal_driver_unique" unique("deal_id","driver_id")
);
--> statement-breakpoint
create table "dispatch_logs" (
	"id" uuid primary key default gen_random_uuid() not null,
	"deal_id" uuid not null,
	"driver_id" uuid,
	"dispatch_job_id" uuid,
	"event_type" "dispatch_event_type" not null,
	"message" text not null,
	"created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
alter table "dispatch_jobs" add constraint "dispatch_jobs_deal_id_deals_id_fk" foreign key ("deal_id") references "public"."deals"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "dispatch_jobs" add constraint "dispatch_jobs_driver_id_users_id_fk" foreign key ("driver_id") references "public"."users"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "dispatch_jobs" add constraint "dispatch_jobs_trip_id_available_trips_id_fk" foreign key ("trip_id") references "public"."available_trips"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "dispatch_logs" add constraint "dispatch_logs_deal_id_deals_id_fk" foreign key ("deal_id") references "public"."deals"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "dispatch_logs" add constraint "dispatch_logs_driver_id_users_id_fk" foreign key ("driver_id") references "public"."users"("id") on delete set null on update no action;
--> statement-breakpoint
alter table "dispatch_logs" add constraint "dispatch_logs_dispatch_job_id_dispatch_jobs_id_fk" foreign key ("dispatch_job_id") references "public"."dispatch_jobs"("id") on delete set null on update no action;
--> statement-breakpoint
alter table "dispatch_jobs" enable row level security;
--> statement-breakpoint
alter table "dispatch_logs" enable row level security;
--> statement-breakpoint
create policy "Allow dispatch participants read" on "dispatch_jobs" as permissive for select to "authenticated" using (
  auth.uid() = "driver_id"
  or auth.uid() in (select buyer_id from deals where id="deal_id")
  or auth.uid() in (select farmer_id from deals where id="deal_id")
);
--> statement-breakpoint
create policy "Allow dispatch participants read logs" on "dispatch_logs" as permissive for select to "authenticated" using (
  auth.uid() = "driver_id"
  or auth.uid() in (select buyer_id from deals where id="deal_id")
  or auth.uid() in (select farmer_id from deals where id="deal_id")
);
