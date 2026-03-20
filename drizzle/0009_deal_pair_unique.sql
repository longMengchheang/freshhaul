create unique index if not exists "deals_demand_shipment_unique_idx"
  on "deals" ("demand_id", "shipment_id");
