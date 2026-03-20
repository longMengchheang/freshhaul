create type "public"."user_role_status" as enum('active', 'pending_verification', 'rejected', 'suspended');
--> statement-breakpoint

create table "user_roles" (
  "id" uuid primary key default gen_random_uuid() not null,
  "user_id" uuid not null,
  "role_name" "user_role" not null,
  "status" "user_role_status" default 'pending_verification' not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "user_roles_user_id_role_name_unique" unique("user_id","role_name")
);
--> statement-breakpoint

alter table "user_roles" add constraint "user_roles_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade on update no action;
--> statement-breakpoint

insert into "user_roles" ("user_id", "role_name", "status")
select "id", 'buyer'::"user_role", 'active'::"user_role_status"
from "users"
on conflict ("user_id", "role_name") do update
set
  "status" = excluded."status",
  "updated_at" = now();
--> statement-breakpoint

insert into "user_roles" ("user_id", "role_name", "status")
select "id", "role", 'active'::"user_role_status"
from "users"
where "role" <> 'buyer'
on conflict ("user_id", "role_name") do update
set
  "status" = excluded."status",
  "updated_at" = now();
--> statement-breakpoint

alter table "user_roles" enable row level security;
--> statement-breakpoint

create policy "Allow own role read" on "user_roles" as permissive for select to authenticated using (auth.uid() = "user_roles"."user_id");
--> statement-breakpoint

alter table "users" drop column "role";
