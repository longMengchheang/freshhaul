ALTER TABLE "users"
ADD COLUMN "country_code" text NOT NULL DEFAULT 'KH';

ALTER TABLE "buyer_demands"
ADD COLUMN "delivery_country_code" text NOT NULL DEFAULT 'KH';

ALTER TABLE "shipment_requests"
ADD COLUMN "pickup_country_code" text NOT NULL DEFAULT 'KH';

ALTER TABLE "available_trips"
ADD COLUMN "from_country_code" text NOT NULL DEFAULT 'KH',
ADD COLUMN "to_country_code" text NOT NULL DEFAULT 'KH';
