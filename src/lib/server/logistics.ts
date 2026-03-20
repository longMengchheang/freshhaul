import "server-only";

import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  availableTrips,
  buyerDemands,
  deals,
  marketplacePromotions,
  matches,
  shipmentRequests,
} from "@/lib/db/schema";
import { getRouteMatchProfile } from "@/lib/province";
import type {
  DealWithDetails,
  DemandWithBuyer,
  MarketplacePromotion,
  MatchingDealCandidate,
  ShipmentWithFarmer,
  TripWithDriver,
} from "@/types/app";

function isDispatchSchemaError(error: unknown) {
  const maybeCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code)
    : "";
  const maybeMessage = error instanceof Error ? error.message : "";

  if (maybeCode === "42P01" || maybeCode === "42703") {
    return true;
  }

  return /dispatch_jobs|dispatch_logs|priority_rank|dispatch_job_id/i.test(maybeMessage);
}

function isAvatarSchemaError(error: unknown) {
  const maybeCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code)
    : "";
  const maybeMessage = error instanceof Error ? error.message : "";

  if (maybeCode === "42703") {
    return true;
  }

  return /avatar_url|column .*avatar_url.* does not exist/i.test(maybeMessage);
}

function isAvailableTripsSchemaError(error: unknown) {
  const maybeCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code)
    : "";
  const maybeMessage = error instanceof Error ? error.message : "";

  if (maybeCode === "42P01" || maybeCode === "42703") {
    return true;
  }

  return /available_trips|availableTrips|is_hot_mode_active|hot_mode_/i.test(maybeMessage);
}

export async function findDemandById(demandId: string) {
  try {
    return await db.query.buyerDemands.findFirst({
      where: eq(buyerDemands.id, demandId),
      with: {
        buyer: {
          columns: {
            name: true,
            phone: true,
            avatar_url: true,
            province: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isAvatarSchemaError(error)) {
      throw error;
    }

    return db.query.buyerDemands.findFirst({
      where: eq(buyerDemands.id, demandId),
      with: {
        buyer: {
          columns: {
            name: true,
            phone: true,
            province: true,
          },
        },
      },
    });
  }
}

export async function findShipmentById(shipmentId: string) {
  try {
    return await db.query.shipmentRequests.findFirst({
      where: eq(shipmentRequests.id, shipmentId),
      with: {
        farmer: {
          columns: {
            name: true,
            phone: true,
            avatar_url: true,
            province: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isAvatarSchemaError(error)) {
      throw error;
    }

    return db.query.shipmentRequests.findFirst({
      where: eq(shipmentRequests.id, shipmentId),
      with: {
        farmer: {
          columns: {
            name: true,
            phone: true,
            province: true,
          },
        },
      },
    });
  }
}

export async function listOpenDemands(): Promise<DemandWithBuyer[]> {
  const now = new Date();
  const demandRows = await (async () => {
    try {
      return await db.query.buyerDemands.findMany({
        where: and(
          eq(buyerDemands.status, "open"),
          gte(buyerDemands.deadline, now),
        ),
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
        },
        orderBy: [desc(buyerDemands.created_at)],
      });
    } catch (error) {
      if (!isAvatarSchemaError(error)) {
        throw error;
      }

      return db.query.buyerDemands.findMany({
        where: and(
          eq(buyerDemands.status, "open"),
          gte(buyerDemands.deadline, now),
        ),
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
        },
        orderBy: [desc(buyerDemands.created_at)],
      });
    }
  })();

  return demandRows as DemandWithBuyer[];
}

export async function listOpenShipmentOffers(): Promise<ShipmentWithFarmer[]> {
  const now = new Date();
  const shipmentRows = await (async () => {
    try {
      return await db.query.shipmentRequests.findMany({
        where: and(
          eq(shipmentRequests.status, "open"),
          gte(shipmentRequests.deadline, now),
        ),
        with: {
          farmer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
        },
        orderBy: [desc(shipmentRequests.created_at)],
      });
    } catch (error) {
      if (!isAvatarSchemaError(error)) {
        throw error;
      }

      return db.query.shipmentRequests.findMany({
        where: and(
          eq(shipmentRequests.status, "open"),
          gte(shipmentRequests.deadline, now),
        ),
        with: {
          farmer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
        },
        orderBy: [desc(shipmentRequests.created_at)],
      });
    }
  })();

  return shipmentRows as ShipmentWithFarmer[];
}

export async function listActiveMarketplaceHeroPromotion(): Promise<MarketplacePromotion | null> {
  try {
    const now = new Date();
    const rows = await db.query.marketplacePromotions.findMany({
      where: and(
        eq(marketplacePromotions.slot, "marketplace_hero"),
        eq(marketplacePromotions.is_active, true),
        lte(marketplacePromotions.start_at, now),
        or(
          isNull(marketplacePromotions.end_at),
          gte(marketplacePromotions.end_at, now),
        ),
      ),
      with: {
        farmer: {
          columns: {
            name: true,
            phone: true,
            province: true,
          },
        },
      },
      orderBy: [desc(marketplacePromotions.display_order), desc(marketplacePromotions.updated_at)],
      limit: 1,
    });

    return (rows[0] as MarketplacePromotion | undefined) ?? null;
  } catch (error) {
    const maybeCode = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : "";
    const maybeMessage = error instanceof Error ? error.message : "";
    if (maybeCode === "42P01" || /relation .*marketplace_promotions.* does not exist/i.test(maybeMessage)) {
      return null;
    }
    throw error;
  }
}

export async function listMyDemands(userId: string) {
  return db.query.buyerDemands.findMany({
    where: eq(buyerDemands.buyer_id, userId),
    orderBy: [desc(buyerDemands.created_at)],
  });
}

export async function listMyShipmentOffers(userId: string) {
  return db.query.shipmentRequests.findMany({
    where: eq(shipmentRequests.farmer_id, userId),
    orderBy: [desc(shipmentRequests.created_at)],
  });
}

async function hydrateDeals(whereClause: ReturnType<typeof eq> | ReturnType<typeof or> | ReturnType<typeof inArray>): Promise<DealWithDetails[]> {
  const dealRows = await (async () => {
    try {
      return await db.query.deals.findMany({
        where: whereClause,
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
          matches: {
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  avatar_url: true,
                  province: true,
                },
              },
            },
          },
          dispatchJobs: {
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  avatar_url: true,
                  province: true,
                },
              },
            },
            orderBy: (fields, { asc }) => [asc(fields.priority_rank)],
          },
          dispatchLogs: {
            columns: {
              id: true,
              deal_id: true,
              driver_id: true,
              dispatch_job_id: true,
              event_type: true,
              message: true,
              created_at: true,
            },
            orderBy: (fields, { desc }) => [desc(fields.created_at)],
          },
        },
        orderBy: [desc(deals.created_at)],
      });
    } catch (error) {
      if (!isAvatarSchemaError(error) && !isDispatchSchemaError(error)) {
        throw error;
      }

      return db.query.deals.findMany({
        where: whereClause,
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
          matches: {
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  province: true,
                },
              },
            },
          },
        },
        orderBy: [desc(deals.created_at)],
      });
    }
  })();

  return dealRows as DealWithDetails[];
}

async function hydrateDealsCompact(whereClause: ReturnType<typeof eq> | ReturnType<typeof or> | ReturnType<typeof inArray>): Promise<DealWithDetails[]> {
  const dealRows = await (async () => {
    try {
      return await db.query.deals.findMany({
        where: whereClause,
        columns: {
          id: true,
          buyer_id: true,
          farmer_id: true,
          demand_id: true,
          shipment_id: true,
          agreed_price_usd: true,
          quantity_kg: true,
          status: true,
          created_at: true,
        },
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
          matches: {
            columns: {
              id: true,
              deal_id: true,
              driver_id: true,
              status: true,
              commission_percent: true,
              created_at: true,
            },
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  avatar_url: true,
                  province: true,
                },
              },
            },
          },
        },
        orderBy: [desc(deals.created_at)],
      });
    } catch (error) {
      if (!isAvatarSchemaError(error) && !isDispatchSchemaError(error)) {
        throw error;
      }

      return db.query.deals.findMany({
        where: whereClause,
        columns: {
          id: true,
          buyer_id: true,
          farmer_id: true,
          demand_id: true,
          shipment_id: true,
          agreed_price_usd: true,
          quantity_kg: true,
          status: true,
          created_at: true,
        },
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
          matches: {
            columns: {
              id: true,
              deal_id: true,
              driver_id: true,
              status: true,
              commission_percent: true,
              created_at: true,
            },
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  province: true,
                },
              },
            },
          },
        },
        orderBy: [desc(deals.created_at)],
      });
    }
  })();

  return dealRows as DealWithDetails[];
}

export async function listDealsForParticipants(userId: string): Promise<DealWithDetails[]> {
  return hydrateDeals(
    or(
      eq(deals.buyer_id, userId),
      eq(deals.farmer_id, userId),
    ),
  );
}

export async function listDealsForParticipantsCompact(userId: string): Promise<DealWithDetails[]> {
  return hydrateDealsCompact(
    or(
      eq(deals.buyer_id, userId),
      eq(deals.farmer_id, userId),
    ),
  );
}

export async function listBuyerDealsForDashboard(userId: string) {
  return db.query.deals.findMany({
    where: eq(deals.buyer_id, userId),
    columns: {
      id: true,
      status: true,
      created_at: true,
    },
    with: {
      demand: {
        columns: {
          delivery_province: true,
        },
      },
      shipment: {
        columns: {
          produce_type: true,
          pickup_province: true,
        },
      },
    },
    orderBy: [desc(deals.created_at)],
  });
}

export async function listFarmerDealsForDashboard(userId: string) {
  return db.query.deals.findMany({
    where: eq(deals.farmer_id, userId),
    columns: {
      id: true,
      status: true,
      created_at: true,
    },
    with: {
      demand: {
        columns: {
          delivery_province: true,
        },
      },
      shipment: {
        columns: {
          produce_type: true,
          pickup_province: true,
        },
      },
    },
    orderBy: [desc(deals.created_at)],
  });
}

export async function listDriverDealsForDashboard(userId: string) {
  const rows = await db.query.matches.findMany({
    where: eq(matches.driver_id, userId),
    columns: {
      id: true,
    },
    with: {
      deal: {
        columns: {
          id: true,
          status: true,
          created_at: true,
        },
        with: {
          demand: {
            columns: {
              delivery_province: true,
            },
          },
          shipment: {
            columns: {
              pickup_province: true,
              produce_type: true,
            },
          },
        },
      },
    },
    orderBy: [desc(matches.created_at)],
  });

  return rows.map((row) => row.deal);
}

export async function listDriverTripsForDashboard(userId: string) {
  return db.query.availableTrips.findMany({
    where: eq(availableTrips.driver_id, userId),
    columns: {
      id: true,
      from_province: true,
      to_province: true,
      created_at: true,
    },
    orderBy: [desc(availableTrips.created_at)],
  });
}

export async function listDealsForDriverBoard(): Promise<DealWithDetails[]> {
  const rows = await hydrateDeals(
    or(
      eq(deals.status, "accepted"),
      eq(deals.status, "transport_pending"),
    ),
  );

  // A transport job should only appear if no driver has claimed it yet.
  return rows.filter((deal) => deal.matches.length === 0);
}

export async function listDealsForDriverMatches(userId: string): Promise<DealWithDetails[]> {
  const matchedDealRows = await db.query.matches.findMany({
    where: eq(matches.driver_id, userId),
    columns: {
      deal_id: true,
    },
  });

  const matchedDealIds = matchedDealRows.map((match) => match.deal_id);
  if (matchedDealIds.length === 0) {
    return [];
  }

  return hydrateDeals(inArray(deals.id, matchedDealIds));
}

export async function listDealsForDriverMatchesCompact(userId: string): Promise<DealWithDetails[]> {
  const matchedDealRows = await db.query.matches.findMany({
    where: eq(matches.driver_id, userId),
    columns: {
      deal_id: true,
    },
  });

  const matchedDealIds = matchedDealRows.map((match) => match.deal_id);
  if (matchedDealIds.length === 0) {
    return [];
  }

  return hydrateDealsCompact(inArray(deals.id, matchedDealIds));
}

export async function findDealById(dealId: string): Promise<DealWithDetails | null> {
  const dealRow = await (async () => {
    try {
      return await db.query.deals.findFirst({
        where: eq(deals.id, dealId),
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
          matches: {
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  avatar_url: true,
                  province: true,
                },
              },
            },
          },
          dispatchJobs: {
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  avatar_url: true,
                  province: true,
                },
              },
            },
            orderBy: (fields, { asc }) => [asc(fields.priority_rank)],
          },
          dispatchLogs: {
            columns: {
              id: true,
              deal_id: true,
              driver_id: true,
              dispatch_job_id: true,
              event_type: true,
              message: true,
              created_at: true,
            },
            orderBy: (fields, { desc }) => [desc(fields.created_at)],
          },
        },
      });
    } catch (error) {
      if (!isAvatarSchemaError(error) && !isDispatchSchemaError(error)) {
        throw error;
      }

      return db.query.deals.findFirst({
        where: eq(deals.id, dealId),
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
          matches: {
            with: {
              driver: {
                columns: {
                  name: true,
                  phone: true,
                  province: true,
                },
              },
            },
          },
        },
      });
    }
  })();

  return (dealRow as DealWithDetails | null) ?? null;
}

export async function findAccessibleDeal(
  dealId: string,
  userId: string,
): Promise<DealWithDetails | null> {
  const dealRow = await db.query.deals.findFirst({
    where: and(
      eq(deals.id, dealId),
      or(
        eq(deals.buyer_id, userId),
        eq(deals.farmer_id, userId),
      ),
    ),
    with: {
      buyer: {
        columns: {
          name: true,
          phone: true,
          avatar_url: true,
          province: true,
        },
      },
      farmer: {
        columns: {
          name: true,
          phone: true,
          avatar_url: true,
          province: true,
        },
      },
      demand: true,
      shipment: true,
      matches: {
        with: {
          driver: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
        },
      },
      dispatchJobs: {
        with: {
          driver: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
        },
        orderBy: (fields, { asc }) => [asc(fields.priority_rank)],
      },
      dispatchLogs: {
        columns: {
          id: true,
          deal_id: true,
          driver_id: true,
          dispatch_job_id: true,
          event_type: true,
          message: true,
          created_at: true,
        },
        orderBy: (fields, { desc }) => [desc(fields.created_at)],
      },
    },
  });

  return (dealRow as DealWithDetails | null) ?? null;
}

export async function findAccessibleTransportDeal(
  dealId: string,
  userId: string,
): Promise<DealWithDetails | null> {
  let dealRow: DealWithDetails | null = null;

  try {
    dealRow = (await db.query.deals.findFirst({
      where: eq(deals.id, dealId),
      with: {
        buyer: {
          columns: {
            name: true,
            phone: true,
            avatar_url: true,
            province: true,
          },
        },
        farmer: {
          columns: {
            name: true,
            phone: true,
            avatar_url: true,
            province: true,
          },
        },
        demand: true,
        shipment: true,
        matches: {
          with: {
            driver: {
              columns: {
                name: true,
                phone: true,
                avatar_url: true,
                province: true,
              },
            },
          },
        },
        dispatchJobs: {
          with: {
            driver: {
              columns: {
                name: true,
                phone: true,
                avatar_url: true,
                province: true,
              },
            },
          },
          orderBy: (fields, { asc }) => [asc(fields.priority_rank)],
        },
        dispatchLogs: {
          columns: {
            id: true,
            deal_id: true,
            driver_id: true,
            dispatch_job_id: true,
            event_type: true,
            message: true,
            created_at: true,
          },
          orderBy: (fields, { desc }) => [desc(fields.created_at)],
        },
      },
    }) as DealWithDetails | null);
  } catch (error) {
    if (!isDispatchSchemaError(error)) {
      throw error;
    }

    dealRow = (await db.query.deals.findFirst({
      where: eq(deals.id, dealId),
      with: {
        buyer: {
          columns: {
            name: true,
            phone: true,
            avatar_url: true,
            province: true,
          },
        },
        farmer: {
          columns: {
            name: true,
            phone: true,
            avatar_url: true,
            province: true,
          },
        },
        demand: true,
        shipment: true,
        matches: {
          with: {
            driver: {
              columns: {
                name: true,
                phone: true,
                avatar_url: true,
                province: true,
              },
            },
          },
        },
      },
    }) as DealWithDetails | null);

    if (dealRow) {
      dealRow = {
        ...dealRow,
        dispatchJobs: dealRow.dispatchJobs ?? [],
        dispatchLogs: dealRow.dispatchLogs ?? [],
      };
    }
  }

  if (!dealRow) {
    return null;
  }

  const hasAccess =
    dealRow.buyer_id === userId ||
    dealRow.farmer_id === userId ||
    dealRow.matches.some((match) => match.driver_id === userId);

  return hasAccess ? dealRow : null;
}

export async function listAvailableTripsForDriver(userId: string): Promise<TripWithDriver[]> {
  const tripRows = await (async () => {
    try {
      return await db.query.availableTrips.findMany({
        where: eq(availableTrips.driver_id, userId),
        columns: {
          id: true,
          driver_id: true,
          from_country_code: true,
          from_province: true,
          to_country_code: true,
          to_province: true,
          truck_type: true,
          capacity_kg: true,
          available_from: true,
          available_to: true,
          price_per_kg: true,
          status: true,
          created_at: true,
        },
        with: {
          driver: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
        },
        orderBy: [desc(availableTrips.created_at)],
      });
    } catch (error) {
      if (!isAvatarSchemaError(error) && !isAvailableTripsSchemaError(error)) {
        throw error;
      }

      return db.query.availableTrips.findMany({
        where: eq(availableTrips.driver_id, userId),
        columns: {
          id: true,
          driver_id: true,
          from_country_code: true,
          from_province: true,
          to_country_code: true,
          to_province: true,
          truck_type: true,
          capacity_kg: true,
          available_from: true,
          available_to: true,
          price_per_kg: true,
          status: true,
          created_at: true,
        },
        with: {
          driver: {
            columns: {
              name: true,
              phone: true,
              province: true,
            },
          },
        },
        orderBy: [desc(availableTrips.created_at)],
      });
    }
  })();

  return tripRows.map((row) => {
    const driver = row.driver as {
      name: string;
      phone: string;
      province: string;
      avatar_url?: string | null;
    };

    return {
      ...row,
      driver: {
        ...driver,
        avatar_url: driver.avatar_url ?? null,
      },
    };
  }) as TripWithDriver[];
}

export function routeMatchesDeal(
  fromCountryCode: string,
  fromProvince: string,
  toCountryCode: string,
  toProvince: string,
  deal: DealWithDetails,
) {
  return getRouteMatchProfile({
    fromCountryCode,
    fromProvince,
    toCountryCode,
    toProvince,
    pickupCountryCode: deal.shipment.pickup_country_code,
    pickupProvince: deal.shipment.pickup_province,
    deliveryCountryCode: deal.demand.delivery_country_code,
    deliveryProvince: deal.demand.delivery_province,
  }).exact;
}

export function filterMatchingDealsForRoute(
  dealRows: DealWithDetails[],
  fromCountryCode: string,
  fromProvince: string,
  toCountryCode: string,
  toProvince: string,
): MatchingDealCandidate[] {
  return dealRows
    .filter((deal) => routeMatchesDeal(fromCountryCode, fromProvince, toCountryCode, toProvince, deal))
    .map((deal) => ({
      ...deal,
      routeMatch: true,
    }));
}

export function filterRouteOpportunityDeals(
  dealRows: DealWithDetails[],
  fromCountryCode: string,
  fromProvince: string,
  toCountryCode: string,
  toProvince: string,
): MatchingDealCandidate[] {
  return dealRows.reduce<MatchingDealCandidate[]>((accumulator, deal) => {
      const profile = getRouteMatchProfile({
        fromCountryCode,
        fromProvince,
        toCountryCode,
        toProvince,
        pickupCountryCode: deal.shipment.pickup_country_code,
        pickupProvince: deal.shipment.pickup_province,
        deliveryCountryCode: deal.demand.delivery_country_code,
        deliveryProvince: deal.demand.delivery_province,
      });

      if (profile.exact || (!profile.fromMatchesPickup && !profile.toMatchesDelivery)) {
        return accumulator;
      }

      const routeHint = profile.fromMatchesPickup
        ? 'Pickup province matches your route start. Destination differs.'
        : 'Delivery province matches your route destination. Pickup differs.';

      accumulator.push({
        ...deal,
        routeMatch: false,
        routeHint,
      });

      return accumulator;
    }, []);
}

export async function listDriverTransportMatches(userId: string) {
  return db.query.matches.findMany({
    where: eq(matches.driver_id, userId),
    with: {
      deal: {
        with: {
          buyer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          farmer: {
            columns: {
              name: true,
              phone: true,
              avatar_url: true,
              province: true,
            },
          },
          demand: true,
          shipment: true,
        },
      },
      driver: {
        columns: {
          name: true,
          phone: true,
          avatar_url: true,
          province: true,
        },
      },
    },
    orderBy: [desc(matches.created_at)],
  });
}
