CREATE TYPE "public"."match_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'matched', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('active', 'full', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('farmer', 'driver');--> statement-breakpoint
CREATE TABLE "available_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"from_province" text NOT NULL,
	"to_province" text NOT NULL,
	"capacity_kg" numeric(10, 2) NOT NULL,
	"departure_time" timestamp with time zone NOT NULL,
	"status" "trip_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"trip_id" uuid,
	"farmer_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"commission_percent" numeric(4, 2) DEFAULT '5.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"produce_type" text NOT NULL,
	"quantity_kg" numeric(10, 2) NOT NULL,
	"pickup_lat" numeric(10, 8) NOT NULL,
	"pickup_lng" numeric(10, 8) NOT NULL,
	"pickup_province" text NOT NULL,
	"destination_province" text NOT NULL,
	"temp_required" text NOT NULL,
	"price_offer_usd" numeric(10, 2) NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"province" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "available_trips" ADD CONSTRAINT "available_trips_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_shipment_id_shipment_requests_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_trip_id_available_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."available_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_requests" ADD CONSTRAINT "shipment_requests_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;