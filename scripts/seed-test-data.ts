import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';

loadEnv({ path: '.env.local' });
loadEnv();

type Status = 'open' | 'pending' | 'matched';

const now = new Date();
const addDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const IDS = {
  buyerA: '00000000-0000-4000-8000-000000000101',
  buyerB: '00000000-0000-4000-8000-000000000102',
  farmerA: '00000000-0000-4000-8000-000000000103',
  farmerB: '00000000-0000-4000-8000-000000000104',
  driverA: '00000000-0000-4000-8000-000000000105',
  driverB: '00000000-0000-4000-8000-000000000106',
  admin: '00000000-0000-4000-8000-000000000107',
  promoPrimary: '70000000-0000-4000-8000-000000000901',
  promoSecondary: '70000000-0000-4000-8000-000000000902',
  promoScheduled: '70000000-0000-4000-8000-000000000903',
  ratingA: '80000000-0000-4000-8000-000000001001',
  ratingB: '80000000-0000-4000-8000-000000001002',
  ratingC: '80000000-0000-4000-8000-000000001003',
  repA: '90000000-0000-4000-8000-000000001101',
  repB: '90000000-0000-4000-8000-000000001102',
} as const;

const AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
];

const PHOTOS = [
  'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1594282486552-05a2f6f7a6d3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1574226516831-e1dff420e12f?auto=format&fit=crop&w=1200&q=80',
];

const PRODUCTS = [
  'Mango',
  'Banana',
  'Longan',
  'Durian',
  'Dragon Fruit',
  'Papaya',
  'Pineapple',
  'Orange',
  'Avocado',
  'Lime',
];

const DEMAND_PROVINCES = ['Phnom Penh', 'Kandal', 'Siem Reap', 'Battambang', 'Kampot'];
const PICKUP_PROVINCES = ['Kandal', 'Takeo', 'Kampong Speu', 'Siem Reap', 'Battambang'];

function makeId(prefix: string, n: number) {
  return `${prefix}${(n + 1).toString().padStart(2, '0')}`.padEnd(36, '0');
}

async function seed() {
  const { db } = await import('../src/lib/db');
  const {
    availableTrips,
    buyerDemands,
    deals,
    dispatchJobs,
    dispatchLogs,
    driverRatings,
    driverReputationScores,
    marketplacePromotions,
    messages,
    shipmentRequests,
    userRoles,
    users,
  } = await import('../src/lib/db/schema');

  const seededUsers = [
    { id: IDS.buyerA, system_role: 'user' as const, name: 'Test Buyer A', phone: '+85510000001', avatar_url: AVATARS[0], country_code: 'KH', province: 'Phnom Penh' },
    { id: IDS.buyerB, system_role: 'user' as const, name: 'Test Buyer B', phone: '+85510000002', avatar_url: AVATARS[1], country_code: 'KH', province: 'Siem Reap' },
    { id: IDS.farmerA, system_role: 'user' as const, name: 'Test Farmer A', phone: '+85510000003', avatar_url: AVATARS[2], country_code: 'KH', province: 'Kandal' },
    { id: IDS.farmerB, system_role: 'user' as const, name: 'Test Farmer B', phone: '+85510000004', avatar_url: AVATARS[3], country_code: 'KH', province: 'Battambang' },
    { id: IDS.driverA, system_role: 'user' as const, name: 'Test Driver A', phone: '+85510000005', avatar_url: AVATARS[4], country_code: 'KH', province: 'Phnom Penh' },
    { id: IDS.driverB, system_role: 'user' as const, name: 'Test Driver B', phone: '+85510000006', avatar_url: AVATARS[5], country_code: 'KH', province: 'Siem Reap' },
    { id: IDS.admin, system_role: 'admin' as const, name: 'Test Admin', phone: '+85510000007', avatar_url: AVATARS[6], country_code: 'KH', province: 'Phnom Penh' },
  ];

  const roleRows = [
    { user_id: IDS.buyerA, role_name: 'buyer' as const, status: 'active' as const },
    { user_id: IDS.buyerB, role_name: 'buyer' as const, status: 'active' as const },
    { user_id: IDS.farmerA, role_name: 'buyer' as const, status: 'active' as const },
    { user_id: IDS.farmerA, role_name: 'farmer' as const, status: 'active' as const },
    { user_id: IDS.farmerB, role_name: 'buyer' as const, status: 'active' as const },
    { user_id: IDS.farmerB, role_name: 'farmer' as const, status: 'active' as const },
    { user_id: IDS.driverA, role_name: 'buyer' as const, status: 'active' as const },
    { user_id: IDS.driverA, role_name: 'driver' as const, status: 'active' as const },
    { user_id: IDS.driverB, role_name: 'buyer' as const, status: 'active' as const },
    { user_id: IDS.driverB, role_name: 'driver' as const, status: 'active' as const },
    { user_id: IDS.admin, role_name: 'buyer' as const, status: 'active' as const },
  ];

  const demandRows = Array.from({ length: 10 }).map((_, i) => {
    const statusOrder: Status[] = ['open', 'pending', 'matched'];
    const status = statusOrder[i % statusOrder.length];

    return {
      id: makeId('10000000-0000-4000-8000-0000000002', i),
      buyer_id: i % 2 === 0 ? IDS.buyerA : IDS.buyerB,
      produce_type: PRODUCTS[i],
      quantity_kg: (100 + i * 10).toFixed(2),
      max_price_usd: (95 + i * 8).toFixed(2),
      delivery_lat: (11.55 + i * 0.02).toFixed(8),
      delivery_lng: (104.90 + i * 0.02).toFixed(8),
      delivery_country_code: 'KH',
      delivery_province: DEMAND_PROVINCES[i % DEMAND_PROVINCES.length],
      deadline: addDays(2 + i),
      status,
    };
  });

  const shipmentRows = Array.from({ length: 10 }).map((_, i) => ({
    id: makeId('20000000-0000-4000-8000-0000000003', i),
    farmer_id: i % 2 === 0 ? IDS.farmerA : IDS.farmerB,
    produce_type: PRODUCTS[i],
    quantity_kg: (120 + i * 12).toFixed(2),
    product_image_url: PHOTOS[i],
    product_image_public_id: `seed/product_${(i + 1).toString().padStart(2, '0')}`,
    pickup_lat: (11.45 + i * 0.018).toFixed(8),
    pickup_lng: (104.88 + i * 0.018).toFixed(8),
    pickup_country_code: 'KH',
    pickup_province: PICKUP_PROVINCES[i % PICKUP_PROVINCES.length],
    temp_required: i % 3 === 0 ? 'cold' : i % 3 === 1 ? 'chill' : 'ambient',
    deadline: addDays(1 + i),
    status: i < 6 ? 'open' as const : 'reserved' as const,
  }));

  const tripRows = [
    {
      id: '30000000-0000-4000-8000-000000000401',
      driver_id: IDS.driverA,
      from_country_code: 'KH',
      from_province: 'Kandal',
      to_country_code: 'KH',
      to_province: 'Phnom Penh',
      truck_type: 'small_cold_van',
      capacity_kg: '1200.00',
      available_from: now,
      available_to: addDays(4),
      price_per_kg: '0.70',
      status: 'active' as const,
    },
    {
      id: '30000000-0000-4000-8000-000000000402',
      driver_id: IDS.driverA,
      from_country_code: 'KH',
      from_province: 'Takeo',
      to_country_code: 'KH',
      to_province: 'Phnom Penh',
      truck_type: 'medium_reefer_truck',
      capacity_kg: '2000.00',
      available_from: now,
      available_to: addDays(4),
      price_per_kg: '0.90',
      status: 'active' as const,
    },
    {
      id: '30000000-0000-4000-8000-000000000403',
      driver_id: IDS.driverB,
      from_country_code: 'KH',
      from_province: 'Siem Reap',
      to_country_code: 'KH',
      to_province: 'Battambang',
      truck_type: 'small_cold_van',
      capacity_kg: '1000.00',
      available_from: now,
      available_to: addDays(5),
      price_per_kg: '0.80',
      status: 'active' as const,
    },
    {
      id: '30000000-0000-4000-8000-000000000404',
      driver_id: IDS.driverB,
      from_country_code: 'KH',
      from_province: 'Kampong Speu',
      to_country_code: 'KH',
      to_province: 'Kandal',
      truck_type: 'large_reefer_truck',
      capacity_kg: '3500.00',
      available_from: now,
      available_to: addDays(6),
      price_per_kg: '1.10',
      status: 'active' as const,
    },
  ];

  const dealRows = Array.from({ length: 10 }).map((_, i) => {
    const statuses = ['pending', 'accepted', 'transport_pending', 'in_transit', 'completed'] as const;
    return {
      id: makeId('40000000-0000-4000-8000-0000000005', i),
      buyer_id: i % 2 === 0 ? IDS.buyerA : IDS.buyerB,
      farmer_id: i % 2 === 0 ? IDS.farmerA : IDS.farmerB,
      demand_id: demandRows[i].id,
      shipment_id: shipmentRows[i].id,
      agreed_price_usd: (90 + i * 11).toFixed(2),
      quantity_kg: (90 + i * 9).toFixed(2),
      status: statuses[i % statuses.length],
    };
  });

  const dispatchRows = [
    {
      id: '50000000-0000-4000-8000-000000000601',
      deal_id: dealRows[2].id,
      driver_id: IDS.driverA,
      trip_id: tripRows[0].id,
      score: '91.00',
      priority_rank: 1,
      status: 'queued' as const,
      expires_at: new Date(now.getTime() + 45 * 60 * 1000),
    },
    {
      id: '50000000-0000-4000-8000-000000000602',
      deal_id: dealRows[7].id,
      driver_id: IDS.driverB,
      trip_id: tripRows[2].id,
      score: '86.50',
      priority_rank: 2,
      status: 'seen' as const,
      expires_at: new Date(now.getTime() + 30 * 60 * 1000),
    },
  ];

  const dispatchLogRows = [
    {
      id: '50000000-0000-4000-8000-000000000701',
      deal_id: dealRows[2].id,
      driver_id: IDS.driverA,
      dispatch_job_id: dispatchRows[0].id,
      event_type: 'driver_notified' as const,
      message: 'Seeded dispatch notification for Driver A.',
    },
    {
      id: '50000000-0000-4000-8000-000000000702',
      deal_id: dealRows[7].id,
      driver_id: IDS.driverB,
      dispatch_job_id: dispatchRows[1].id,
      event_type: 'driver_notified' as const,
      message: 'Seeded dispatch notification for Driver B.',
    },
  ];

  const messageRows = [
    {
      id: '60000000-0000-4000-8000-000000000801',
      deal_id: dealRows[0].id,
      match_id: null,
      sender_id: IDS.buyerA,
      recipient_id: IDS.farmerA,
      content: 'Can this shipment be loaded tomorrow morning?',
    },
    {
      id: '60000000-0000-4000-8000-000000000802',
      deal_id: dealRows[2].id,
      match_id: null,
      sender_id: IDS.farmerA,
      recipient_id: IDS.buyerA,
      content: 'Confirmed. Produce is ready for pickup.',
    },
  ];

  const driverRatingRows = [
    {
      id: IDS.ratingA,
      driver_id: IDS.driverA,
      rater_id: IDS.buyerA,
      rater_role: 'buyer',
      deal_id: dealRows[0].id,
      overall_rating: 5,
      speed_rating: 5,
      communication_rating: 4,
      vehicle_condition_rating: 5,
      professionalism_rating: 5,
      reliability_rating: 5,
      comment: 'Fast and careful handoff, produce arrived fresh.',
      is_anonymous: false,
    },
    {
      id: IDS.ratingB,
      driver_id: IDS.driverA,
      rater_id: IDS.farmerA,
      rater_role: 'farmer',
      deal_id: dealRows[2].id,
      overall_rating: 4,
      speed_rating: 4,
      communication_rating: 5,
      vehicle_condition_rating: 4,
      professionalism_rating: 4,
      reliability_rating: 4,
      comment: 'Good communication and on-time pickup.',
      is_anonymous: false,
    },
    {
      id: IDS.ratingC,
      driver_id: IDS.driverB,
      rater_id: IDS.buyerB,
      rater_role: 'buyer',
      deal_id: dealRows[4].id,
      overall_rating: 5,
      speed_rating: 4,
      communication_rating: 5,
      vehicle_condition_rating: 5,
      professionalism_rating: 5,
      reliability_rating: 5,
      comment: 'Reliable and professional delivery.',
      is_anonymous: false,
    },
  ];

  const driverReputationRows = [
    {
      id: IDS.repA,
      driver_id: IDS.driverA,
      total_ratings: 2,
      average_rating: '4.50',
      average_speed: '4.50',
      average_communication: '4.50',
      average_vehicle_condition: '4.50',
      average_professionalism: '4.50',
      average_reliability: '4.50',
      rating_count_5_star: 1,
      rating_count_4_star: 1,
      rating_count_3_star: 0,
      rating_count_2_star: 0,
      rating_count_1_star: 0,
      reputation_badge: 'Trusted Driver',
      last_updated: now,
    },
    {
      id: IDS.repB,
      driver_id: IDS.driverB,
      total_ratings: 1,
      average_rating: '5.00',
      average_speed: '4.00',
      average_communication: '5.00',
      average_vehicle_condition: '5.00',
      average_professionalism: '5.00',
      average_reliability: '5.00',
      rating_count_5_star: 1,
      rating_count_4_star: 0,
      rating_count_3_star: 0,
      rating_count_2_star: 0,
      rating_count_1_star: 0,
      reputation_badge: 'Rising Driver',
      last_updated: now,
    },
  ];

  await db.transaction(async (tx) => {
    for (const user of seededUsers) {
      await tx.insert(users).values(user).onConflictDoNothing();
      await tx.update(users).set(user).where(eq(users.id, user.id));
    }

    for (const role of roleRows) {
      await tx
        .insert(userRoles)
        .values(role)
        .onConflictDoUpdate({
          target: [userRoles.user_id, userRoles.role_name],
          set: { status: role.status, updated_at: now },
        });
    }

    for (const row of demandRows) {
      await tx.insert(buyerDemands).values(row).onConflictDoNothing();
      await tx.update(buyerDemands).set(row).where(eq(buyerDemands.id, row.id));
    }

    for (const row of shipmentRows) {
      await tx.insert(shipmentRequests).values(row).onConflictDoNothing();
      await tx.update(shipmentRequests).set(row).where(eq(shipmentRequests.id, row.id));
    }

    for (const row of tripRows) {
      await tx.insert(availableTrips).values(row).onConflictDoNothing();
      await tx.update(availableTrips).set(row).where(eq(availableTrips.id, row.id));
    }

    for (const row of dealRows) {
      await tx.insert(deals).values(row).onConflictDoNothing();
      await tx.update(deals).set(row).where(eq(deals.id, row.id));
    }

    for (const row of dispatchRows) {
      await tx.insert(dispatchJobs).values(row).onConflictDoNothing();
      await tx.update(dispatchJobs).set({ ...row, updated_at: now }).where(eq(dispatchJobs.id, row.id));
    }

    for (const row of dispatchLogRows) {
      await tx.insert(dispatchLogs).values(row).onConflictDoNothing();
      await tx.update(dispatchLogs).set(row).where(eq(dispatchLogs.id, row.id));
    }

    for (const row of messageRows) {
      await tx.insert(messages).values(row).onConflictDoNothing();
      await tx.update(messages).set(row).where(eq(messages.id, row.id));
    }

    for (const row of driverRatingRows) {
      await tx.insert(driverRatings).values(row).onConflictDoNothing();
      await tx.update(driverRatings).set({ ...row, updated_at: now }).where(eq(driverRatings.id, row.id));
    }

    for (const row of driverReputationRows) {
      await tx
        .insert(driverReputationScores)
        .values(row)
        .onConflictDoUpdate({
          target: driverReputationScores.driver_id,
          set: {
            total_ratings: row.total_ratings,
            average_rating: row.average_rating,
            average_speed: row.average_speed,
            average_communication: row.average_communication,
            average_vehicle_condition: row.average_vehicle_condition,
            average_professionalism: row.average_professionalism,
            average_reliability: row.average_reliability,
            rating_count_5_star: row.rating_count_5_star,
            rating_count_4_star: row.rating_count_4_star,
            rating_count_3_star: row.rating_count_3_star,
            rating_count_2_star: row.rating_count_2_star,
            rating_count_1_star: row.rating_count_1_star,
            reputation_badge: row.reputation_badge,
            last_updated: row.last_updated,
          },
        });
    }
  });

  try {
    const promotionRows = [
      {
        id: IDS.promoPrimary,
        slot: 'marketplace_hero' as const,
        media_type: 'image' as const,
        media_url: PHOTOS[0],
        headline: 'Fresh premium mango available this week',
        subheadline: 'Top-quality produce with fast cold-chain handoff.',
        cta_label: 'View farmer profile',
        cta_href: `/users/${IDS.farmerA}`,
        farmer_id: IDS.farmerA,
        created_by: IDS.admin,
        is_active: true,
        start_at: now,
        end_at: null,
        display_order: 900,
        updated_at: now,
      },
      {
        id: IDS.promoSecondary,
        slot: 'marketplace_hero' as const,
        media_type: 'image' as const,
        media_url: PHOTOS[3],
        headline: 'Durian premium lot from verified farm',
        subheadline: 'Secondary spotlight sample for testing campaign order.',
        cta_label: 'Open seller',
        cta_href: `/users/${IDS.farmerB}`,
        farmer_id: IDS.farmerB,
        created_by: IDS.admin,
        is_active: true,
        start_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        end_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        display_order: 500,
        updated_at: now,
      },
      {
        id: IDS.promoScheduled,
        slot: 'marketplace_hero' as const,
        media_type: 'image' as const,
        media_url: PHOTOS[6],
        headline: 'Scheduled future campaign sample',
        subheadline: 'This one should not appear until start time.',
        cta_label: 'Preview seller',
        cta_href: `/users/${IDS.farmerA}`,
        farmer_id: IDS.farmerA,
        created_by: IDS.admin,
        is_active: true,
        start_at: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        end_at: null,
        display_order: 700,
        updated_at: now,
      },
    ];

    for (const promotionRow of promotionRows) {
      await db
        .insert(marketplacePromotions)
        .values(promotionRow)
        .onConflictDoUpdate({
          target: marketplacePromotions.id,
          set: {
            slot: promotionRow.slot,
            media_type: promotionRow.media_type,
            media_url: promotionRow.media_url,
            headline: promotionRow.headline,
            subheadline: promotionRow.subheadline,
            cta_label: promotionRow.cta_label,
            cta_href: promotionRow.cta_href,
            farmer_id: promotionRow.farmer_id,
            created_by: promotionRow.created_by,
            is_active: promotionRow.is_active,
            start_at: promotionRow.start_at,
            end_at: promotionRow.end_at,
            display_order: promotionRow.display_order,
            updated_at: promotionRow.updated_at,
          },
        });
    }
  } catch (error) {
    const maybeCode = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
    if (maybeCode !== '42P01') {
      throw error;
    }
    console.warn('Skipped promotion seed because marketplace_promotions table is missing.');
  }

  console.log('Seeded test dataset successfully.');
  console.log(`Users: ${seededUsers.length}, demands: ${demandRows.length}, shipments: ${shipmentRows.length}, deals: ${dealRows.length}`);
  console.log(`Driver ratings: ${driverRatingRows.length}, reputation rows: ${driverReputationRows.length}.`);
  console.log('Shipment photo URLs and spotlight promotion test data seeded (3 campaign rows).');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
