CREATE INDEX IF NOT EXISTS "idx_buyer_demands_delivery_location_status"
ON "buyer_demands" ("delivery_country_code", "delivery_province", "status");

CREATE INDEX IF NOT EXISTS "idx_shipment_requests_pickup_location_status"
ON "shipment_requests" ("pickup_country_code", "pickup_province", "status");

CREATE INDEX IF NOT EXISTS "idx_available_trips_route_status"
ON "available_trips" ("from_country_code", "from_province", "to_country_code", "to_province", "status");

CREATE INDEX IF NOT EXISTS "idx_available_trips_driver_status"
ON "available_trips" ("driver_id", "status");
