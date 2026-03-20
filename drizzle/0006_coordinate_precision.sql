alter table "buyer_demands"
  alter column "delivery_lat" type numeric(11, 8);
--> statement-breakpoint
alter table "buyer_demands"
  alter column "delivery_lng" type numeric(11, 8);
--> statement-breakpoint
alter table "shipment_requests"
  alter column "pickup_lat" type numeric(11, 8);
--> statement-breakpoint
alter table "shipment_requests"
  alter column "pickup_lng" type numeric(11, 8);
