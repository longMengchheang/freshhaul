create type "public"."marketplace_promotion_slot" as enum('marketplace_hero');
--> statement-breakpoint
create type "public"."marketplace_promotion_media_type" as enum('image', 'video');
--> statement-breakpoint
create table "marketplace_promotions" (
	"id" uuid primary key default gen_random_uuid() not null,
	"slot" "marketplace_promotion_slot" default 'marketplace_hero' not null,
	"media_type" "marketplace_promotion_media_type" default 'image' not null,
	"media_url" text not null,
	"headline" text not null,
	"subheadline" text,
	"cta_label" text,
	"cta_href" text,
	"farmer_id" uuid,
	"created_by" uuid,
	"is_active" boolean default true not null,
	"start_at" timestamp with time zone default now() not null,
	"end_at" timestamp with time zone,
	"display_order" integer default 0 not null,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
alter table "marketplace_promotions" add constraint "marketplace_promotions_farmer_id_users_id_fk" foreign key ("farmer_id") references "public"."users"("id") on delete set null on update no action;
--> statement-breakpoint
alter table "marketplace_promotions" add constraint "marketplace_promotions_created_by_users_id_fk" foreign key ("created_by") references "public"."users"("id") on delete set null on update no action;
--> statement-breakpoint
alter table "marketplace_promotions" enable row level security;
--> statement-breakpoint
create policy "Allow authenticated promotion read" on "marketplace_promotions" as permissive for select to "authenticated" using (true);
--> statement-breakpoint
create index "idx_marketplace_promotions_slot_active_window" on "marketplace_promotions" using btree ("slot","is_active","start_at","end_at");
--> statement-breakpoint
create index "idx_marketplace_promotions_display_order" on "marketplace_promotions" using btree ("display_order","updated_at");
