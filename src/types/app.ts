import type { User } from "@supabase/supabase-js";

export type AppRoleName = "farmer" | "buyer" | "driver";
export type AppRoleStatus = "active" | "pending_verification" | "rejected" | "suspended";
export type AppCapabilityState = AppRoleStatus | "not_applied";
export type AppSystemRole = "user" | "admin";

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_name: AppRoleName;
  status: AppRoleStatus;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface AppRoleStates {
  buyer: AppCapabilityState;
  farmer: AppCapabilityState;
  driver: AppCapabilityState;
}

export interface AppUserProfile {
  id: string;
  system_role: AppSystemRole;
  name: string;
  phone: string;
  avatar_url: string | null;
  country_code: string;
  province: string;
  created_at: string | Date;
  roles: UserRoleAssignment[];
}

export interface BuyerDemandSummary {
  id: string;
  buyer_id: string;
  produce_type: string;
  quantity_kg: string;
  max_price_usd: string;
  delivery_lat: string;
  delivery_lng: string;
  delivery_country_code: string;
  delivery_province: string;
  deadline: string | Date;
  status: string;
  created_at: string | Date;
}

export interface ShipmentOfferSummary {
  id: string;
  farmer_id: string;
  produce_type: string;
  quantity_kg: string;
  product_image_url?: string | null;
  product_image_public_id?: string | null;
  pickup_lat: string;
  pickup_lng: string;
  pickup_country_code: string;
  pickup_province: string;
  temp_required: string;
  deadline: string | Date;
  status: string;
  created_at: string | Date;
}

export interface ShipmentWithFarmer extends ShipmentOfferSummary {
  farmer: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
}

export interface MarketplacePromotion {
  id: string;
  slot: "marketplace_hero";
  media_type: "image" | "video";
  media_url: string;
  headline: string;
  subheadline: string | null;
  cta_label: string | null;
  cta_href: string | null;
  farmer_id: string | null;
  created_by: string | null;
  is_active: boolean;
  start_at: string | Date;
  end_at: string | Date | null;
  display_order: number;
  created_at: string | Date;
  updated_at: string | Date;
  farmer: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
}

export interface DemandWithBuyer extends BuyerDemandSummary {
  buyer: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
}

export interface AvailableTripSummary {
  id: string;
  driver_id: string;
  from_country_code: string;
  from_province: string;
  to_country_code: string;
  to_province: string;
  truck_type: string;
  capacity_kg: string;
  available_from: string | Date;
  available_to: string | Date;
  price_per_kg: string;
  status: string;
  created_at: string | Date;
}

export interface TripWithDriver extends AvailableTripSummary {
  driver: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
}

export interface DealSummary {
  id: string;
  buyer_id: string;
  farmer_id: string;
  demand_id: string;
  shipment_id: string;
  agreed_price_usd: string;
  quantity_kg: string;
  status: string;
  created_at: string | Date;
}

export interface TransportMatchSummary {
  id: string;
  deal_id: string;
  driver_id: string;
  status: string;
  commission_percent: string;
  created_at: string | Date;
}

export interface TransportMatchWithDriver extends TransportMatchSummary {
  driver: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
}

export interface DispatchJobSummary {
  id: string;
  deal_id: string;
  driver_id: string;
  trip_id: string;
  score: string;
  priority_rank: number;
  status: string;
  expires_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface DispatchJobWithDriver extends DispatchJobSummary {
  driver: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
}

export interface DispatchLogSummary {
  id: string;
  deal_id: string;
  driver_id: string | null;
  dispatch_job_id: string | null;
  event_type: string;
  message: string;
  created_at: string | Date;
}

export interface DealWithDetails extends DealSummary {
  buyer: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
  farmer: Pick<AppUserProfile, "name" | "phone" | "province" | "avatar_url"> | null;
  demand: BuyerDemandSummary;
  shipment: ShipmentOfferSummary;
  matches: TransportMatchWithDriver[];
  dispatchJobs?: DispatchJobWithDriver[];
  dispatchLogs?: DispatchLogSummary[];
}

export interface MatchingDealCandidate extends DealWithDetails {
  routeMatch: boolean;
  routeHint?: string;
  dispatchJob?: DispatchJobSummary | null;
}

export interface DriverBoardDiagnostics {
  totalOpenDeals: number;
  routeMatchedDeals: number;
  routeOpportunityDeals: number;
  queueVisibleDeals: number;
  mismatchSummary: {
    routeMismatch: number;
    capacityMismatch: number;
    scheduleMismatch: number;
  };
}

export interface ChatMessage {
  id: string;
  deal_id: string | null;
  match_id: string | null;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  created_at: string;
}

export interface CurrentUserContext {
  authUser: User;
  profile: AppUserProfile;
  systemRole: AppSystemRole;
  roleStates: AppRoleStates;
  activeRoles: AppRoleName[];
}
