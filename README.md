# FreshHaul

FreshHaul is for a fresh produce marketplace connecting three sides of the transaction:

- Farmers post shipment-ready produce supply.
- Buyers post demand with delivery locations and price ceilings.
- Drivers publish refrigerated trips and claim matched transport jobs.

The app includes Leaflet + OpenStreetMap maps, realtime chat via Supabase, capability-protected App Router pages, and a Bakong KHQR demo payment screen that separates platform and transport commissions.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4 + reusable UI primitives
- Supabase Auth + Realtime
- Postgres on Supabase
- Drizzle ORM
- React Hook Form + Zod
- Leaflet + OpenStreetMap
- `bakong-khqr` for demo KHQR generation

## Pages

- `/` landing page with role selection
- `/auth/login`
- `/auth/register`
- `/auth/complete-profile`
- `/dashboard`
- `/profile`
- `/users/[id]`
- `/admin`
- `/marketplace` marketplace showcase
- `/marketplace/deals` deal collections with smart ranking
- `/marketplace/explore` browse and filter offers/demands
- `/browse` browse shipments
- `/browse-trips` driver trip board
- `/post-demand`
- `/post-shipment`
- `/deals`
- `/orders` order management
- `/matches` demand–supply matching
- `/messages` realtime chat
- `/disputes` dispute resolution
- `/trip/[id]` trip detail with chat and handoff checklist
- `/payment` Bakong KHQR settlement
- `/api/health` deployment health endpoint

## Folder structure

```text
src/
  app/
    actions/           # Server actions (deals, demands, shipments, trips, users, orders, messaging, disputes, …)
    admin/page.tsx
    auth/
      login/page.tsx
      register/page.tsx
      complete-profile/page.tsx
    browse/page.tsx
    browse-trips/page.tsx
    dashboard/page.tsx
    deals/page.tsx
    disputes/page.tsx
    marketplace/
      page.tsx
      deals/page.tsx
      explore/page.tsx
    matches/page.tsx
    messages/page.tsx
    orders/page.tsx
    payment/page.tsx
    post-demand/page.tsx
    post-shipment/page.tsx
    profile/page.tsx
    trip/[id]/page.tsx
    users/[id]/page.tsx
    api/               # API routes (health, etc.)
    globals.css
    layout.tsx
    loading.tsx
    manifest.ts
    page.tsx
  components/
    AuthProvider.tsx
    ChatWindow.tsx
    CountryProvinceSelector.tsx
    DealLifecycleTimeline.tsx
    DriverEarningsDashboard.tsx
    FormProgressCard.tsx
    MapPicker.tsx
    MapPickerInner.tsx
    MarketplaceCollectionsPage.tsx
    MarketplaceShowcase.tsx
    Navbar.tsx
    ProfileCrudCard.tsx
    Providers.tsx
    StatusBadge.tsx
    TripHandoffChecklist.tsx
    ui/                # Reusable primitives (button, card, dialog, input, select, tabs, …)
  lib/
    cambodia.ts
    db/
      index.ts
      schema.ts
    client/            # Client-side utilities (cloudinary, session-cache, ui-config, …)
    server/            # Server-side logic (current-user, dispatch, logistics, payment-engine, …)
    env.ts
    locations.ts
    province.ts
  types/
    app.ts
    orders.ts
    bakong-khqr.d.ts
  utils/
    supabase/
      client.ts
      middleware.ts
      server.ts
scripts/
  seed-test-data.ts
drizzle/               # SQL migrations (0000–latest)
docs/                  # Feature guides and implementation notes
```

## Core flow

1. Every signed-up account starts with buyer access.
2. Users can request farmer or driver capability from the dashboard.
3. Users manage account details and capability requests from `/profile`.
4. An admin reviews pending farmer and driver requests in `/admin`.
5. Buyers post demand, verified farmers post shipment supply, and either side creates a commercial deal.
6. Once the buyer and farmer accept the deal, the deal moves to `transport_pending`.
7. Verified drivers publish available trips and see only deals whose pickup and delivery provinces match their route.
8. Accepted deals now auto-create a dispatch queue for top matching drivers with expiry-based priority.
9. A driver claims the transport leg, realtime chat opens for the relevant participants, and the payment page can generate a Bakong KHQR settlement summary.

## Smart matching logic

Current matching is intentionally simple and explicit:

- Driver trip `from_province` must equal shipment `pickup_province`
- Driver trip `to_province` must equal demand `delivery_province`
- Only accepted deals waiting for transport appear on the driver board
- Dispatch queue prioritizes top route-capable drivers and shows time-to-expire on driver board
- If exact route matches are empty, the driver board also shows partial-route opportunities (pickup-only or delivery-only) so drivers know what route to add next

This is easy to reason about and a good baseline before adding distance or corridor-based routing.

## Environment

Copy `.env.example` to `.env.local`.

```env
DATABASE_URL=postgresql://postgres.yourdbref:yourpassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
BAKONG_ACCOUNT_ID=freshhaul@acleda
BAKONG_MERCHANT_NAME=FreshHaul
BAKONG_MERCHANT_CITY=Phnom Penh
```

## Local setup

1. Install dependencies.
2. Create `.env.local`.
3. Create a Supabase project.
4. Enable Email auth in Supabase.
5. Apply the SQL files in `drizzle/` to your Supabase database in order (`0000` through latest).
6. Start the app.

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Supabase setup

### 1. Authentication

- Enable Email provider.
- Make sure user IDs from `auth.users` are used as the primary key in `public.users`.

### 2. Database

- Use the existing migrations in `drizzle/` as the source of truth for the database schema.
- Apply them in order when provisioning a fresh database or evolving an existing one.

### 3. Realtime chat

In Supabase, enable realtime for `public.messages`.

Example SQL:

```sql
alter publication supabase_realtime add table public.messages;
```

## Leaflet notes

- Map tiles use OpenStreetMap directly, so there is no Google Maps dependency.
- Leaflet CSS is loaded in the client map components.
- Coordinates are stored as numeric latitude/longitude columns in Postgres.

## Cloudinary product photos

- Farmers can upload a product photo in `/post-shipment`.
- The photo is stored in Cloudinary and rendered in marketplace offer cards.
- Create an unsigned upload preset in Cloudinary and set:
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

## Bakong KHQR example

The payment screen currently generates a demo individual KHQR with:

- produce settlement amount
- platform commission
- transport commission

The app uses `bakong-khqr` locally and does not yet execute a bank-backed settlement callback.

## Middleware protection

Protected pages:

- `/dashboard`
- `/marketplace` (and sub-routes)
- `/post-demand`
- `/post-shipment`
- `/browse-trips`
- `/browse`
- `/deals`
- `/orders`
- `/matches`
- `/messages`
- `/disputes`
- `/payment`
- `/trip/[id]`
- `/users/[id]`
- `/profile`
- `/admin`

System roles:

- `user`
- `admin`

Capability gates:

- every account gets buyer access by default
- only verified farmers can post shipment offers
- only verified drivers can access the trip board
- only admins can access `/admin`

## Admin setup

Admin is a system role, not a public signup option.

Create a normal account first, then promote it manually in Supabase:

```sql
update public.users
set system_role = 'admin'
where id = 'YOUR_USER_UUID';
```

After that, the same login will redirect to `/admin`.

Admin panel also includes a Marketplace Hero Promotion section where you can manage top-slot image/video campaigns, optional farmer profile linking, and CTA copy.

## Scripts

- `npm run dev` — start development server
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript compiler checks
- `npm run build` — production build
- `npm run verify` — lint + typecheck + build
- `npm run db:seed:test` — seed database with test data

## Seed test data (with photos)

Run:
```bash
npm run db:seed:test
```

This seeds deterministic users, roles, demands, shipments, trips, deals, dispatch records, and chat data. Shipment rows include product image URLs so marketplace cards show photos.

## Production readiness checklist

Run these before first public usage:

1. Verify database schema state.
2. Verify code quality and production build.
3. Confirm at least one admin account.
4. Smoke test buyer, farmer, and driver paths.

```bash
npm run db:check
npm run verify
```

Admin seed example:

```sql
insert into public.user_roles (user_id, role_name, status)
values ('YOUR_USER_UUID', 'buyer', 'active')
on conflict do nothing;

update public.users
set system_role = 'admin'
where id = 'YOUR_USER_UUID';
```

Manual smoke test minimum:

- Buyer can post demand and see it in marketplace.
- Farmer can post shipment and create/accept a deal.
- Driver can save route, see matching or opportunity jobs, and claim a job.
- `trip/[id]` chat loads for assigned participants.
- `GET /api/health` returns `200` and `{ "status": "ok" }`.

## Notes

- Khmer UI copy is deferred for a later integration pass.
- The payment flow is a demo settlement layer, not a live Bakong production integration.
- Authorization is enforced in server actions because the app uses a direct database connection for writes.
