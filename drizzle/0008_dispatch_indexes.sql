create index if not exists "deals_status_created_at_idx" on "deals" ("status", "created_at");
--> statement-breakpoint
create index if not exists "available_trips_route_status_idx" on "available_trips" ("from_province", "to_province", "status");
--> statement-breakpoint
create index if not exists "user_roles_driver_active_idx" on "user_roles" ("role_name", "status", "user_id");
--> statement-breakpoint
create index if not exists "dispatch_jobs_driver_status_expires_idx" on "dispatch_jobs" ("driver_id", "status", "expires_at");
--> statement-breakpoint
create index if not exists "dispatch_jobs_deal_status_rank_idx" on "dispatch_jobs" ("deal_id", "status", "priority_rank");
--> statement-breakpoint
create unique index if not exists "matches_one_active_driver_per_deal_idx"
  on "matches" ("deal_id")
  where "status" in ('pending', 'accepted', 'in_transit');
