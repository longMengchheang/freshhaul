ALTER TABLE "available_trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shipment_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "Allow public read" ON "available_trips" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Allow members read" ON "matches" AS PERMISSIVE FOR SELECT TO public USING (auth.uid() = "matches"."driver_id" OR auth.uid() = "matches"."farmer_id");--> statement-breakpoint
CREATE POLICY "Allow members read" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (auth.uid() IN (SELECT driver_id FROM matches WHERE id="messages"."match_id") OR auth.uid() IN (SELECT farmer_id FROM matches WHERE id="messages"."match_id"));--> statement-breakpoint
CREATE POLICY "Allow public read" ON "shipment_requests" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Allow public read" ON "users" AS PERMISSIVE FOR SELECT TO public USING (true);