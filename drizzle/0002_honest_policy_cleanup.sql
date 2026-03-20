DROP POLICY IF EXISTS "Allow public read" ON "users";--> statement-breakpoint
DROP POLICY IF EXISTS "Allow public read" ON "shipment_requests";--> statement-breakpoint
DROP POLICY IF EXISTS "Allow public read" ON "available_trips";--> statement-breakpoint
DROP POLICY IF EXISTS "Allow members read" ON "matches";--> statement-breakpoint
DROP POLICY IF EXISTS "Allow members read" ON "messages";--> statement-breakpoint
CREATE POLICY "Allow own profile read" ON "users" AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = "users"."id");--> statement-breakpoint
CREATE POLICY "Allow authenticated shipment read" ON "shipment_requests" AS PERMISSIVE FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "Allow authenticated trip read" ON "available_trips" AS PERMISSIVE FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "Allow members read" ON "matches" AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = "matches"."driver_id" OR auth.uid() = "matches"."farmer_id");--> statement-breakpoint
CREATE POLICY "Allow members read" ON "messages" AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() IN (SELECT driver_id FROM matches WHERE id="messages"."match_id") OR auth.uid() IN (SELECT farmer_id FROM matches WHERE id="messages"."match_id"));--> statement-breakpoint
CREATE POLICY "Allow members insert" ON "messages" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = "messages"."sender_id" AND (auth.uid() IN (SELECT driver_id FROM matches WHERE id="messages"."match_id") OR auth.uid() IN (SELECT farmer_id FROM matches WHERE id="messages"."match_id")));--> statement-breakpoint
