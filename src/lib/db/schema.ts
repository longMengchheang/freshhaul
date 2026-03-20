import {
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  integer,
  boolean,
  unique,
  time,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['farmer', 'buyer', 'driver']);
export const userRoleStatusEnum = pgEnum('user_role_status', ['active', 'pending_verification', 'rejected', 'suspended']);
export const systemRoleEnum = pgEnum('system_role', ['user', 'admin']);
export const demandStatusEnum = pgEnum('demand_status', ['open', 'pending', 'matched', 'fulfilled', 'cancelled']);
export const shipmentStatusEnum = pgEnum('shipment_status', ['open', 'reserved', 'ready_for_transport', 'in_transit', 'completed', 'cancelled']);
export const tripStatusEnum = pgEnum('trip_status', ['active', 'matched', 'in_transit', 'completed', 'cancelled']);
export const dealStatusEnum = pgEnum('deal_status', ['pending', 'accepted', 'rejected', 'transport_pending', 'in_transit', 'completed', 'cancelled']);
export const transportMatchStatusEnum = pgEnum('transport_match_status', ['pending', 'accepted', 'rejected', 'in_transit', 'completed']);
export const dispatchJobStatusEnum = pgEnum('dispatch_job_status', ['queued', 'seen', 'claimed', 'expired', 'cancelled']);
export const dispatchEventTypeEnum = pgEnum('dispatch_event_type', ['deal_queued', 'driver_notified', 'driver_claimed', 'dispatch_expired', 'no_driver_available']);
export const marketplacePromotionSlotEnum = pgEnum('marketplace_promotion_slot', ['marketplace_hero']);
export const marketplacePromotionMediaTypeEnum = pgEnum('marketplace_promotion_media_type', ['image', 'video']);
export const hotModeUrgencyEnum = pgEnum('hot_mode_urgency', ['normal', 'medium', 'high', 'critical']);
export const consolidationStatusEnum = pgEnum('consolidation_status', ['suggested', 'accepted', 'rejected', 'completed', 'cancelled']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['requested', 'processing', 'completed', 'failed', 'cancelled']);
export const ratingCategoryEnum = pgEnum('rating_category', ['speed', 'communication', 'vehicle_condition', 'professionalism', 'reliability']);
export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'under_review', 'resolved', 'rejected']);
export const disputeResolutionEnum = pgEnum('dispute_resolution', ['driver_favored', 'farmer_favored', 'buyer_favored', 'split_decision', 'manual_review']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  system_role: systemRoleEnum('system_role').default('user').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  avatar_url: text('avatar_url'),
  country_code: text('country_code').default('KH').notNull(),
  province: text('province').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow own profile read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.id}`,
  }),
]);

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role_name: userRoleEnum('role_name').notNull(),
  status: userRoleStatusEnum('status').default('pending_verification').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('user_roles_user_id_role_name_unique').on(table.user_id, table.role_name),
  pgPolicy('Allow own role read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.user_id}`,
  }),
]);

export const buyerDemands = pgTable('buyer_demands', {
  id: uuid('id').defaultRandom().primaryKey(),
  buyer_id: uuid('buyer_id').references(() => users.id).notNull(),
  produce_type: text('produce_type').notNull(),
  quantity_kg: numeric('quantity_kg', { precision: 10, scale: 2 }).notNull(),
  max_price_usd: numeric('max_price_usd', { precision: 10, scale: 2 }).notNull(),
  delivery_lat: numeric('delivery_lat', { precision: 11, scale: 8 }).notNull(),
  delivery_lng: numeric('delivery_lng', { precision: 11, scale: 8 }).notNull(),
  delivery_country_code: text('delivery_country_code').default('KH').notNull(),
  delivery_province: text('delivery_province').notNull(),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  status: demandStatusEnum('status').default('open').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('Allow authenticated demand read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
]);

export const shipmentRequests = pgTable('shipment_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmer_id: uuid('farmer_id').references(() => users.id).notNull(),
  produce_type: text('produce_type').notNull(),
  quantity_kg: numeric('quantity_kg', { precision: 10, scale: 2 }).notNull(),
  product_image_url: text('product_image_url'),
  product_image_public_id: text('product_image_public_id'),
  pickup_lat: numeric('pickup_lat', { precision: 11, scale: 8 }).notNull(),
  pickup_lng: numeric('pickup_lng', { precision: 11, scale: 8 }).notNull(),
  pickup_country_code: text('pickup_country_code').default('KH').notNull(),
  pickup_province: text('pickup_province').notNull(),
  temp_required: text('temp_required').notNull(),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  status: shipmentStatusEnum('status').default('open').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('Allow authenticated shipment read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
]);

export const availableTrips = pgTable('available_trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id).notNull(),
  from_country_code: text('from_country_code').default('KH').notNull(),
  from_province: text('from_province').notNull(),
  to_country_code: text('to_country_code').default('KH').notNull(),
  to_province: text('to_province').notNull(),
  truck_type: text('truck_type').notNull(),
  capacity_kg: numeric('capacity_kg', { precision: 10, scale: 2 }).notNull(),
  available_from: timestamp('available_from', { withTimezone: true }).notNull(),
  available_to: timestamp('available_to', { withTimezone: true }).notNull(),
  price_per_kg: numeric('price_per_kg', { precision: 10, scale: 2 }).notNull(),
  status: tripStatusEnum('status').default('active').notNull(),
  is_hot_mode_active: boolean('is_hot_mode_active').default(false).notNull(),
  hot_mode_expires_at: timestamp('hot_mode_expires_at', { withTimezone: true }),
  hot_mode_bonus_multiplier: numeric('hot_mode_bonus_multiplier', { precision: 3, scale: 2 }).default('1.50').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('Allow authenticated trip read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
]);

export const driverSchedules = pgTable('driver_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  monday_from: time('monday_from'),
  monday_to: time('monday_to'),
  tuesday_from: time('tuesday_from'),
  tuesday_to: time('tuesday_to'),
  wednesday_from: time('wednesday_from'),
  wednesday_to: time('wednesday_to'),
  thursday_from: time('thursday_from'),
  thursday_to: time('thursday_to'),
  friday_from: time('friday_from'),
  friday_to: time('friday_to'),
  saturday_from: time('saturday_from'),
  saturday_to: time('saturday_to'),
  sunday_from: time('sunday_from'),
  sunday_to: time('sunday_to'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow own schedule read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.driver_id}`,
  }),
]);

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  buyer_id: uuid('buyer_id').references(() => users.id).notNull(),
  farmer_id: uuid('farmer_id').references(() => users.id).notNull(),
  demand_id: uuid('demand_id').references(() => buyerDemands.id).notNull(),
  shipment_id: uuid('shipment_id').references(() => shipmentRequests.id).notNull(),
  agreed_price_usd: numeric('agreed_price_usd', { precision: 10, scale: 2 }).notNull(),
  quantity_kg: numeric('quantity_kg', { precision: 10, scale: 2 }).notNull(),
  status: dealStatusEnum('status').default('pending').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('deals_demand_shipment_unique').on(table.demand_id, table.shipment_id),
  pgPolicy('Allow deal participants read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.buyer_id} OR auth.uid() = ${table.farmer_id}`,
  }),
]);

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  deal_id: uuid('deal_id').references(() => deals.id).notNull(),
  driver_id: uuid('driver_id').references(() => users.id).notNull(),
  status: transportMatchStatusEnum('status').default('pending').notNull(),
  commission_percent: numeric('commission_percent', { precision: 4, scale: 2 }).default('5.00').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow transport match members read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      auth.uid() = ${table.driver_id}
      OR auth.uid() IN (
        SELECT buyer_id FROM deals WHERE id=${table.deal_id}
      )
      OR auth.uid() IN (
        SELECT farmer_id FROM deals WHERE id=${table.deal_id}
      )
    `,
  }),
]);

export const dispatchJobs = pgTable('dispatch_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deal_id: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  trip_id: uuid('trip_id').references(() => availableTrips.id, { onDelete: 'cascade' }).notNull(),
  score: numeric('score', { precision: 6, scale: 2 }).default('0.00').notNull(),
  priority_rank: integer('priority_rank').notNull(),
  status: dispatchJobStatusEnum('status').default('queued').notNull(),
  urgency: hotModeUrgencyEnum('urgency').default('normal').notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('dispatch_jobs_deal_driver_unique').on(table.deal_id, table.driver_id),
  pgPolicy('Allow dispatch participants read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      auth.uid() = ${table.driver_id}
      OR auth.uid() IN (
        SELECT buyer_id FROM deals WHERE id=${table.deal_id}
      )
      OR auth.uid() IN (
        SELECT farmer_id FROM deals WHERE id=${table.deal_id}
      )
    `,
  }),
]);

export const dispatchLogs = pgTable('dispatch_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deal_id: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'set null' }),
  dispatch_job_id: uuid('dispatch_job_id').references(() => dispatchJobs.id, { onDelete: 'set null' }),
  event_type: dispatchEventTypeEnum('event_type').notNull(),
  message: text('message').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow dispatch participants read logs', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      auth.uid() = ${table.driver_id}
      OR auth.uid() IN (
        SELECT buyer_id FROM deals WHERE id=${table.deal_id}
      )
      OR auth.uid() IN (
        SELECT farmer_id FROM deals WHERE id=${table.deal_id}
      )
    `,
  }),
]);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  deal_id: uuid('deal_id').references(() => deals.id),
  match_id: uuid('match_id').references(() => matches.id),
  sender_id: uuid('sender_id').references(() => users.id).notNull(),
  recipient_id: uuid('recipient_id').references(() => users.id),
  content: text('content').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow members read messages', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      (
        ${table.deal_id} IS NOT NULL
        AND (
          auth.uid() IN (SELECT buyer_id FROM deals WHERE id=${table.deal_id})
          OR auth.uid() IN (SELECT farmer_id FROM deals WHERE id=${table.deal_id})
        )
      )
      OR (
        ${table.match_id} IS NOT NULL
        AND (
          auth.uid() IN (SELECT driver_id FROM matches WHERE id=${table.match_id})
          OR auth.uid() IN (
            SELECT farmer_id FROM deals
            WHERE id IN (SELECT deal_id FROM matches WHERE id=${table.match_id})
          )
        )
      )
    `,
  }),
  pgPolicy('Allow members insert messages', {
    as: 'permissive',
    for: 'insert',
    to: 'authenticated',
    withCheck: sql`
      auth.uid() = ${table.sender_id}
      AND (
        (
          ${table.deal_id} IS NOT NULL
          AND (
            auth.uid() IN (SELECT buyer_id FROM deals WHERE id=${table.deal_id})
            OR auth.uid() IN (SELECT farmer_id FROM deals WHERE id=${table.deal_id})
          )
        )
        OR (
          ${table.match_id} IS NOT NULL
          AND (
            auth.uid() IN (SELECT driver_id FROM matches WHERE id=${table.match_id})
            OR auth.uid() IN (
              SELECT farmer_id FROM deals
              WHERE id IN (SELECT deal_id FROM matches WHERE id=${table.match_id})
            )
          )
        )
      )
    `,
  }),
]);

export const marketplacePromotions = pgTable('marketplace_promotions', {
  id: uuid('id').defaultRandom().primaryKey(),
  slot: marketplacePromotionSlotEnum('slot').default('marketplace_hero').notNull(),
  media_type: marketplacePromotionMediaTypeEnum('media_type').default('image').notNull(),
  media_url: text('media_url').notNull(),
  headline: text('headline').notNull(),
  subheadline: text('subheadline'),
  cta_label: text('cta_label'),
  cta_href: text('cta_href'),
  farmer_id: uuid('farmer_id').references(() => users.id, { onDelete: 'set null' }),
  created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  is_active: boolean('is_active').default(true).notNull(),
  start_at: timestamp('start_at', { withTimezone: true }).defaultNow().notNull(),
  end_at: timestamp('end_at', { withTimezone: true }),
  display_order: integer('display_order').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('Allow authenticated promotion read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
]);

export const jobConsolidations = pgTable('job_consolidations', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  primary_deal_id: uuid('primary_deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  consolidated_deal_ids: uuid('consolidated_deal_ids').array().notNull(),
  status: consolidationStatusEnum('status').default('suggested').notNull(),
  estimated_time_saved_minutes: integer('estimated_time_saved_minutes'),
  earnings_increment_usd: numeric('earnings_increment_usd', { precision: 10, scale: 2 }),
  efficiency_score: numeric('efficiency_score', { precision: 5, scale: 2 }),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow driver consolidation read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.driver_id}`,
  }),
]);

export const consolidationExecutions = pgTable('consolidation_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  consolidation_id: uuid('consolidation_id').references(() => jobConsolidations.id, { onDelete: 'cascade' }).notNull(),
  deal_id: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  sequence_order: integer('sequence_order').notNull(),
  status: text('status').default('pending').notNull(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow driver execution read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      auth.uid() IN (
        SELECT driver_id FROM job_consolidations WHERE id = ${table.consolidation_id}
      )
    `,
  }),
]);

export const driverPaymentMethods = pgTable('driver_payment_methods', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  bakong_account_id: text('bakong_account_id').notNull().unique(),
  account_holder_name: text('account_holder_name').notNull(),
  account_holder_phone: text('account_holder_phone').notNull(),
  verified_at: timestamp('verified_at', { withTimezone: true }),
  is_default: boolean('is_default').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow driver payment method read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.driver_id}`,
  }),
  pgPolicy('Allow driver payment method write', {
    as: 'permissive',
    for: 'insert',
    to: 'authenticated',
    withCheck: sql`auth.uid() = ${table.driver_id}`,
  }),
]);

export const withdrawalRequests = pgTable('withdrawal_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  payment_method_id: uuid('payment_method_id').references(() => driverPaymentMethods.id, { onDelete: 'restrict' }).notNull(),
  amount_usd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  status: withdrawalStatusEnum('status').default('requested').notNull(),
  requested_at: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  processed_at: timestamp('processed_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  failure_reason: text('failure_reason'),
  bakong_transaction_id: text('bakong_transaction_id').unique(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow driver withdrawal read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.driver_id}`,
  }),
  pgPolicy('Allow driver withdrawal write', {
    as: 'permissive',
    for: 'insert',
    to: 'authenticated',
    withCheck: sql`auth.uid() = ${table.driver_id}`,
  }),
]);

export const withdrawalExecutions = pgTable('withdrawal_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  withdrawal_request_id: uuid('withdrawal_request_id').references(() => withdrawalRequests.id, { onDelete: 'cascade' }).notNull(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  payment_method_id: uuid('payment_method_id').references(() => driverPaymentMethods.id, { onDelete: 'restrict' }).notNull(),
  amount_usd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull(),
  bakong_response: text('bakong_response'),
  error_details: text('error_details'),
  attempt_count: integer('attempt_count').default(1).notNull(),
  last_attempt_at: timestamp('last_attempt_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow driver execution read', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`auth.uid() = ${table.driver_id}`,
  }),
]);

export const driverRatings = pgTable('driver_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rater_id: uuid('rater_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rater_role: text('rater_role').notNull(),
  deal_id: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  overall_rating: integer('overall_rating').notNull(),
  speed_rating: integer('speed_rating'),
  communication_rating: integer('communication_rating'),
  vehicle_condition_rating: integer('vehicle_condition_rating'),
  professionalism_rating: integer('professionalism_rating'),
  reliability_rating: integer('reliability_rating'),
  comment: text('comment'),
  is_anonymous: boolean('is_anonymous').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow anyone to read ratings', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
  pgPolicy('Allow rater to write ratings', {
    as: 'permissive',
    for: 'insert',
    to: 'authenticated',
    withCheck: sql`auth.uid() = ${table.rater_id}`,
  }),
]);

export const driverReputationScores = pgTable('driver_reputation_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  driver_id: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  total_ratings: integer('total_ratings').default(0).notNull(),
  average_rating: numeric('average_rating', { precision: 3, scale: 2 }).default('0.00').notNull(),
  average_speed: numeric('average_speed', { precision: 3, scale: 2 }).default('0.00').notNull(),
  average_communication: numeric('average_communication', { precision: 3, scale: 2 }).default('0.00').notNull(),
  average_vehicle_condition: numeric('average_vehicle_condition', { precision: 3, scale: 2 }).default('0.00').notNull(),
  average_professionalism: numeric('average_professionalism', { precision: 3, scale: 2 }).default('0.00').notNull(),
  average_reliability: numeric('average_reliability', { precision: 3, scale: 2 }).default('0.00').notNull(),
  rating_count_5_star: integer('rating_count_5_star').default(0).notNull(),
  rating_count_4_star: integer('rating_count_4_star').default(0).notNull(),
  rating_count_3_star: integer('rating_count_3_star').default(0).notNull(),
  rating_count_2_star: integer('rating_count_2_star').default(0).notNull(),
  rating_count_1_star: integer('rating_count_1_star').default(0).notNull(),
  reputation_badge: text('reputation_badge'),
  last_updated: timestamp('last_updated', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('Allow anyone to read reputation', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
]);

export const reputationBadges = pgTable('reputation_badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  badge_name: text('badge_name').notNull().unique(),
  min_rating: numeric('min_rating', { precision: 3, scale: 2 }).notNull(),
  min_total_ratings: integer('min_total_ratings').notNull(),
  badge_icon: text('badge_icon'),
  badge_color: text('badge_color'),
  description: text('description'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('Allow anyone to read badges', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`true`,
  }),
]);

export const transportDisputes = pgTable('transport_disputes', {
  id: uuid('id').defaultRandom().primaryKey(),
  deal_id: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  match_id: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
  opened_by: uuid('opened_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  respondent_id: uuid('respondent_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason').notNull(),
  evidence_notes: text('evidence_notes'),
  status: disputeStatusEnum('status').default('open').notNull(),
  auto_resolution: disputeResolutionEnum('auto_resolution'),
  auto_confidence: numeric('auto_confidence', { precision: 5, scale: 2 }),
  auto_summary: text('auto_summary'),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow participants to read disputes', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      auth.uid() = ${table.opened_by}
      OR auth.uid() = ${table.respondent_id}
      OR auth.uid() IN (SELECT buyer_id FROM deals WHERE id = ${table.deal_id})
      OR auth.uid() IN (SELECT farmer_id FROM deals WHERE id = ${table.deal_id})
      OR auth.uid() IN (SELECT driver_id FROM matches WHERE id = ${table.match_id})
    `,
  }),
  pgPolicy('Allow participants to open disputes', {
    as: 'permissive',
    for: 'insert',
    to: 'authenticated',
    withCheck: sql`
      auth.uid() = ${table.opened_by}
      AND (
        auth.uid() IN (SELECT buyer_id FROM deals WHERE id = ${table.deal_id})
        OR auth.uid() IN (SELECT farmer_id FROM deals WHERE id = ${table.deal_id})
        OR auth.uid() IN (SELECT driver_id FROM matches WHERE id = ${table.match_id})
      )
    `,
  }),
]);

export const disputeEvents = pgTable('dispute_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  dispute_id: uuid('dispute_id').references(() => transportDisputes.id, { onDelete: 'cascade' }).notNull(),
  actor_id: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  event_type: text('event_type').notNull(),
  message: text('message').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('Allow participants to read dispute events', {
    as: 'permissive',
    for: 'select',
    to: 'authenticated',
    using: sql`
      auth.uid() = ${table.actor_id}
      OR auth.uid() IN (
        SELECT opened_by FROM transport_disputes WHERE id = ${table.dispute_id}
        UNION
        SELECT respondent_id FROM transport_disputes WHERE id = ${table.dispute_id}
      )
    `,
  }),
  pgPolicy('Allow participants to insert dispute events', {
    as: 'permissive',
    for: 'insert',
    to: 'authenticated',
    withCheck: sql`
      auth.uid() = ${table.actor_id}
      AND auth.uid() IN (
        SELECT opened_by FROM transport_disputes WHERE id = ${table.dispute_id}
        UNION
        SELECT respondent_id FROM transport_disputes WHERE id = ${table.dispute_id}
      )
    `,
  }),
]);

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  demands: many(buyerDemands),
  shipments: many(shipmentRequests),
  trips: many(availableTrips),
  buyerDeals: many(deals, { relationName: 'buyerDeals' }),
  farmerDeals: many(deals, { relationName: 'farmerDeals' }),
  driverMatches: many(matches),
  dispatchJobs: many(dispatchJobs),
  dispatchLogs: many(dispatchLogs),
  sentMessages: many(messages, { relationName: 'sentMessages' }),
  receivedMessages: many(messages, { relationName: 'receivedMessages' }),
  marketplacePromotions: many(marketplacePromotions, { relationName: 'promotionFarmer' }),
  createdPromotions: many(marketplacePromotions, { relationName: 'promotionCreator' }),
  consolidations: many(jobConsolidations),
  paymentMethods: many(driverPaymentMethods),
  withdrawalRequests: many(withdrawalRequests),
  withdrawalExecutions: many(withdrawalExecutions),
  receivedRatings: many(driverRatings, { relationName: 'receivedRatings' }),
  givenRatings: many(driverRatings, { relationName: 'givenRatings' }),
  reputationScore: many(driverReputationScores),
  openedDisputes: many(transportDisputes, { relationName: 'openedDisputes' }),
  respondedDisputes: many(transportDisputes, { relationName: 'respondedDisputes' }),
  disputeEvents: many(disputeEvents),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.user_id],
    references: [users.id],
  }),
}));

export const buyerDemandsRelations = relations(buyerDemands, ({ one, many }) => ({
  buyer: one(users, {
    fields: [buyerDemands.buyer_id],
    references: [users.id],
  }),
  deals: many(deals),
}));

export const shipmentRequestsRelations = relations(shipmentRequests, ({ one, many }) => ({
  farmer: one(users, {
    fields: [shipmentRequests.farmer_id],
    references: [users.id],
  }),
  deals: many(deals),
}));

export const availableTripsRelations = relations(availableTrips, ({ one, many }) => ({
  driver: one(users, {
    fields: [availableTrips.driver_id],
    references: [users.id],
  }),
  dispatchJobs: many(dispatchJobs),
}));

export const driverSchedulesRelations = relations(driverSchedules, ({ one }) => ({
  driver: one(users, {
    fields: [driverSchedules.driver_id],
    references: [users.id],
  }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  buyer: one(users, {
    fields: [deals.buyer_id],
    references: [users.id],
    relationName: 'buyerDeals',
  }),
  farmer: one(users, {
    fields: [deals.farmer_id],
    references: [users.id],
    relationName: 'farmerDeals',
  }),
  demand: one(buyerDemands, {
    fields: [deals.demand_id],
    references: [buyerDemands.id],
  }),
  shipment: one(shipmentRequests, {
    fields: [deals.shipment_id],
    references: [shipmentRequests.id],
  }),
  matches: many(matches),
  dispatchJobs: many(dispatchJobs),
  dispatchLogs: many(dispatchLogs),
  messages: many(messages),
  disputes: many(transportDisputes),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  deal: one(deals, {
    fields: [matches.deal_id],
    references: [deals.id],
  }),
  driver: one(users, {
    fields: [matches.driver_id],
    references: [users.id],
  }),
  messages: many(messages),
  disputes: many(transportDisputes),
}));

export const dispatchJobsRelations = relations(dispatchJobs, ({ one }) => ({
  deal: one(deals, {
    fields: [dispatchJobs.deal_id],
    references: [deals.id],
  }),
  driver: one(users, {
    fields: [dispatchJobs.driver_id],
    references: [users.id],
  }),
  trip: one(availableTrips, {
    fields: [dispatchJobs.trip_id],
    references: [availableTrips.id],
  }),
}));

export const dispatchLogsRelations = relations(dispatchLogs, ({ one }) => ({
  deal: one(deals, {
    fields: [dispatchLogs.deal_id],
    references: [deals.id],
  }),
  driver: one(users, {
    fields: [dispatchLogs.driver_id],
    references: [users.id],
  }),
  dispatchJob: one(dispatchJobs, {
    fields: [dispatchLogs.dispatch_job_id],
    references: [dispatchJobs.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  deal: one(deals, {
    fields: [messages.deal_id],
    references: [deals.id],
  }),
  match: one(matches, {
    fields: [messages.match_id],
    references: [matches.id],
  }),
  sender: one(users, {
    fields: [messages.sender_id],
    references: [users.id],
    relationName: 'sentMessages',
  }),
  recipient: one(users, {
    fields: [messages.recipient_id],
    references: [users.id],
    relationName: 'receivedMessages',
  }),
}));

export const marketplacePromotionsRelations = relations(marketplacePromotions, ({ one }) => ({
  farmer: one(users, {
    fields: [marketplacePromotions.farmer_id],
    references: [users.id],
    relationName: 'promotionFarmer',
  }),
  creator: one(users, {
    fields: [marketplacePromotions.created_by],
    references: [users.id],
    relationName: 'promotionCreator',
  }),
}));

export const jobConsolidationsRelations = relations(jobConsolidations, ({ one, many }) => ({
  driver: one(users, {
    fields: [jobConsolidations.driver_id],
    references: [users.id],
  }),
  primaryDeal: one(deals, {
    fields: [jobConsolidations.primary_deal_id],
    references: [deals.id],
  }),
  executions: many(consolidationExecutions),
}));

export const consolidationExecutionsRelations = relations(consolidationExecutions, ({ one }) => ({
  consolidation: one(jobConsolidations, {
    fields: [consolidationExecutions.consolidation_id],
    references: [jobConsolidations.id],
  }),
  deal: one(deals, {
    fields: [consolidationExecutions.deal_id],
    references: [deals.id],
  }),
}));

export const driverPaymentMethodsRelations = relations(driverPaymentMethods, ({ one, many }) => ({
  driver: one(users, {
    fields: [driverPaymentMethods.driver_id],
    references: [users.id],
  }),
  withdrawalRequests: many(withdrawalRequests),
  withdrawalExecutions: many(withdrawalExecutions),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one, many }) => ({
  driver: one(users, {
    fields: [withdrawalRequests.driver_id],
    references: [users.id],
  }),
  paymentMethod: one(driverPaymentMethods, {
    fields: [withdrawalRequests.payment_method_id],
    references: [driverPaymentMethods.id],
  }),
  executions: many(withdrawalExecutions),
}));

export const withdrawalExecutionsRelations = relations(withdrawalExecutions, ({ one }) => ({
  withdrawalRequest: one(withdrawalRequests, {
    fields: [withdrawalExecutions.withdrawal_request_id],
    references: [withdrawalRequests.id],
  }),
  driver: one(users, {
    fields: [withdrawalExecutions.driver_id],
    references: [users.id],
  }),
  paymentMethod: one(driverPaymentMethods, {
    fields: [withdrawalExecutions.payment_method_id],
    references: [driverPaymentMethods.id],
  }),
}));

export const driverRatingsRelations = relations(driverRatings, ({ one }) => ({
  driver: one(users, {
    fields: [driverRatings.driver_id],
    references: [users.id],
    relationName: 'receivedRatings',
  }),
  rater: one(users, {
    fields: [driverRatings.rater_id],
    references: [users.id],
    relationName: 'givenRatings',
  }),
  deal: one(deals, {
    fields: [driverRatings.deal_id],
    references: [deals.id],
  }),
}));

export const driverReputationScoresRelations = relations(driverReputationScores, ({ one }) => ({
  driver: one(users, {
    fields: [driverReputationScores.driver_id],
    references: [users.id],
  }),
}));

export const reputationBadgesRelations = relations(reputationBadges, () => ({
  // Used for badge assignment logic
}));

export const transportDisputesRelations = relations(transportDisputes, ({ one, many }) => ({
  deal: one(deals, {
    fields: [transportDisputes.deal_id],
    references: [deals.id],
  }),
  match: one(matches, {
    fields: [transportDisputes.match_id],
    references: [matches.id],
  }),
  openedBy: one(users, {
    fields: [transportDisputes.opened_by],
    references: [users.id],
    relationName: 'openedDisputes',
  }),
  respondent: one(users, {
    fields: [transportDisputes.respondent_id],
    references: [users.id],
    relationName: 'respondedDisputes',
  }),
  events: many(disputeEvents),
}));

export const disputeEventsRelations = relations(disputeEvents, ({ one }) => ({
  dispute: one(transportDisputes, {
    fields: [disputeEvents.dispute_id],
    references: [transportDisputes.id],
  }),
  actor: one(users, {
    fields: [disputeEvents.actor_id],
    references: [users.id],
  }),
}));
