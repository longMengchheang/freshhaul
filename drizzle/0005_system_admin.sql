create type "public"."system_role" as enum('user', 'admin');
--> statement-breakpoint

alter table "users" add column "system_role" "system_role" default 'user' not null;
