create extension if not exists pgcrypto;
--> statement-breakpoint

drop table if exists public.messages cascade;
--> statement-breakpoint
drop table if exists public.matches cascade;
--> statement-breakpoint
drop table if exists public.deals cascade;
--> statement-breakpoint
drop table if exists public.available_trips cascade;
--> statement-breakpoint
drop table if exists public.shipment_requests cascade;
--> statement-breakpoint
drop table if exists public.buyer_demands cascade;
--> statement-breakpoint
drop table if exists public.users cascade;
--> statement-breakpoint

drop type if exists public.transport_match_status cascade;
--> statement-breakpoint
drop type if exists public.deal_status cascade;
--> statement-breakpoint
drop type if exists public.demand_status cascade;
--> statement-breakpoint
drop type if exists public.match_status cascade;
--> statement-breakpoint
drop type if exists public.trip_status cascade;
--> statement-breakpoint
drop type if exists public.shipment_status cascade;
--> statement-breakpoint
drop type if exists public.user_role cascade;
--> statement-breakpoint

create type "public"."user_role" as enum('farmer', 'buyer', 'driver');
--> statement-breakpoint
create type "public"."demand_status" as enum('open', 'pending', 'matched', 'fulfilled', 'cancelled');
--> statement-breakpoint
create type "public"."shipment_status" as enum('open', 'reserved', 'ready_for_transport', 'in_transit', 'completed', 'cancelled');
--> statement-breakpoint
create type "public"."trip_status" as enum('active', 'matched', 'in_transit', 'completed', 'cancelled');
--> statement-breakpoint
create type "public"."deal_status" as enum('pending', 'accepted', 'rejected', 'transport_pending', 'in_transit', 'completed', 'cancelled');
--> statement-breakpoint
create type "public"."transport_match_status" as enum('pending', 'accepted', 'rejected', 'in_transit', 'completed');
--> statement-breakpoint

create table "users" (
  "id" uuid primary key not null,
  "role" "user_role" not null,
  "name" text not null,
  "phone" text not null,
  "province" text not null,
  "created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint

create table "buyer_demands" (
  "id" uuid primary key default gen_random_uuid() not null,
  "buyer_id" uuid not null,
  "produce_type" text not null,
  "quantity_kg" numeric(10, 2) not null,
  "max_price_usd" numeric(10, 2) not null,
  "delivery_lat" numeric(10, 8) not null,
  "delivery_lng" numeric(10, 8) not null,
  "delivery_province" text not null,
  "deadline" timestamp with time zone not null,
  "status" "demand_status" default 'open' not null,
  "created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint

create table "shipment_requests" (
  "id" uuid primary key default gen_random_uuid() not null,
  "farmer_id" uuid not null,
  "produce_type" text not null,
  "quantity_kg" numeric(10, 2) not null,
  "pickup_lat" numeric(10, 8) not null,
  "pickup_lng" numeric(10, 8) not null,
  "pickup_province" text not null,
  "temp_required" text not null,
  "deadline" timestamp with time zone not null,
  "status" "shipment_status" default 'open' not null,
  "created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint

create table "available_trips" (
  "id" uuid primary key default gen_random_uuid() not null,
  "driver_id" uuid not null,
  "from_province" text not null,
  "to_province" text not null,
  "truck_type" text not null,
  "capacity_kg" numeric(10, 2) not null,
  "available_from" timestamp with time zone not null,
  "available_to" timestamp with time zone not null,
  "price_per_kg" numeric(10, 2) not null,
  "status" "trip_status" default 'active' not null,
  "created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint

create table "deals" (
  "id" uuid primary key default gen_random_uuid() not null,
  "buyer_id" uuid not null,
  "farmer_id" uuid not null,
  "demand_id" uuid not null,
  "shipment_id" uuid not null,
  "agreed_price_usd" numeric(10, 2) not null,
  "quantity_kg" numeric(10, 2) not null,
  "status" "deal_status" default 'pending' not null,
  "created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint

create table "matches" (
  "id" uuid primary key default gen_random_uuid() not null,
  "deal_id" uuid not null,
  "driver_id" uuid not null,
  "status" "transport_match_status" default 'pending' not null,
  "commission_percent" numeric(4, 2) default '5.00' not null,
  "created_at" timestamp with time zone default now() not null
);
--> statement-breakpoint

create table "messages" (
  "id" uuid primary key default gen_random_uuid() not null,
  "deal_id" uuid,
  "match_id" uuid,
  "sender_id" uuid not null,
  "recipient_id" uuid,
  "content" text not null,
  "created_at" timestamp with time zone default now() not null,
  constraint "messages_scope_check" check (
    ("deal_id" is not null and "match_id" is null)
    or ("deal_id" is null and "match_id" is not null)
  )
);
--> statement-breakpoint

alter table "buyer_demands" add constraint "buyer_demands_buyer_id_users_id_fk" foreign key ("buyer_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "shipment_requests" add constraint "shipment_requests_farmer_id_users_id_fk" foreign key ("farmer_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "available_trips" add constraint "available_trips_driver_id_users_id_fk" foreign key ("driver_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "deals" add constraint "deals_buyer_id_users_id_fk" foreign key ("buyer_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "deals" add constraint "deals_farmer_id_users_id_fk" foreign key ("farmer_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "deals" add constraint "deals_demand_id_buyer_demands_id_fk" foreign key ("demand_id") references "public"."buyer_demands"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "deals" add constraint "deals_shipment_id_shipment_requests_id_fk" foreign key ("shipment_id") references "public"."shipment_requests"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "matches" add constraint "matches_deal_id_deals_id_fk" foreign key ("deal_id") references "public"."deals"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "matches" add constraint "matches_driver_id_users_id_fk" foreign key ("driver_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "messages" add constraint "messages_deal_id_deals_id_fk" foreign key ("deal_id") references "public"."deals"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "messages" add constraint "messages_match_id_matches_id_fk" foreign key ("match_id") references "public"."matches"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "messages" add constraint "messages_sender_id_users_id_fk" foreign key ("sender_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint
alter table "messages" add constraint "messages_recipient_id_users_id_fk" foreign key ("recipient_id") references "public"."users"("id") on delete no action on update no action;
--> statement-breakpoint

create index "idx_buyer_demands_buyer_id" on "buyer_demands" using btree ("buyer_id");
--> statement-breakpoint
create index "idx_buyer_demands_status" on "buyer_demands" using btree ("status");
--> statement-breakpoint
create index "idx_shipment_requests_farmer_id" on "shipment_requests" using btree ("farmer_id");
--> statement-breakpoint
create index "idx_shipment_requests_status" on "shipment_requests" using btree ("status");
--> statement-breakpoint
create index "idx_available_trips_driver_id" on "available_trips" using btree ("driver_id");
--> statement-breakpoint
create index "idx_available_trips_route" on "available_trips" using btree ("from_province", "to_province", "status");
--> statement-breakpoint
create index "idx_deals_participants" on "deals" using btree ("buyer_id", "farmer_id", "status");
--> statement-breakpoint
create index "idx_matches_deal_id" on "matches" using btree ("deal_id");
--> statement-breakpoint
create index "idx_messages_deal_id" on "messages" using btree ("deal_id", "created_at");
--> statement-breakpoint
create index "idx_messages_match_id" on "messages" using btree ("match_id", "created_at");
--> statement-breakpoint

alter table "users" enable row level security;
--> statement-breakpoint
alter table "buyer_demands" enable row level security;
--> statement-breakpoint
alter table "shipment_requests" enable row level security;
--> statement-breakpoint
alter table "available_trips" enable row level security;
--> statement-breakpoint
alter table "deals" enable row level security;
--> statement-breakpoint
alter table "matches" enable row level security;
--> statement-breakpoint
alter table "messages" enable row level security;
--> statement-breakpoint

create policy "Allow own profile read" on "users" as permissive for select to authenticated using (auth.uid() = "users"."id");
--> statement-breakpoint
create policy "Allow authenticated demand read" on "buyer_demands" as permissive for select to authenticated using (true);
--> statement-breakpoint
create policy "Allow authenticated shipment read" on "shipment_requests" as permissive for select to authenticated using (true);
--> statement-breakpoint
create policy "Allow authenticated trip read" on "available_trips" as permissive for select to authenticated using (true);
--> statement-breakpoint
create policy "Allow deal participants read" on "deals" as permissive for select to authenticated using (auth.uid() = "deals"."buyer_id" or auth.uid() = "deals"."farmer_id");
--> statement-breakpoint
create policy "Allow transport match members read" on "matches" as permissive for select to authenticated using (
  auth.uid() = "matches"."driver_id"
  or auth.uid() in (select buyer_id from deals where id = "matches"."deal_id")
  or auth.uid() in (select farmer_id from deals where id = "matches"."deal_id")
);
--> statement-breakpoint
create policy "Allow members read messages" on "messages" as permissive for select to authenticated using (
  (
    "messages"."deal_id" is not null
    and (
      auth.uid() in (select buyer_id from deals where id = "messages"."deal_id")
      or auth.uid() in (select farmer_id from deals where id = "messages"."deal_id")
    )
  )
  or (
    "messages"."match_id" is not null
    and (
      auth.uid() in (select driver_id from matches where id = "messages"."match_id")
      or auth.uid() in (
        select farmer_id from deals
        where id in (select deal_id from matches where id = "messages"."match_id")
      )
    )
  )
);
--> statement-breakpoint
create policy "Allow members insert messages" on "messages" as permissive for insert to authenticated with check (
  auth.uid() = "messages"."sender_id"
  and (
    (
      "messages"."deal_id" is not null
      and (
        auth.uid() in (select buyer_id from deals where id = "messages"."deal_id")
        or auth.uid() in (select farmer_id from deals where id = "messages"."deal_id")
      )
    )
    or (
      "messages"."match_id" is not null
      and (
        auth.uid() in (select driver_id from matches where id = "messages"."match_id")
        or auth.uid() in (
          select farmer_id from deals
          where id in (select deal_id from matches where id = "messages"."match_id")
        )
      )
    )
  )
);
