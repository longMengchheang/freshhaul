-- FreshHaul KH Database Schema (Supabase / Postgres)

-- Enums
CREATE TYPE user_role AS ENUM ('farmer', 'driver');
CREATE TYPE shipment_status AS ENUM ('pending', 'matched', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE trip_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE match_status AS ENUM ('pending', 'accepted', 'rejected', 'completed');

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY, -- Links to auth.users if needed
  role user_role NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  province TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment Requests (Farmers posting)
CREATE TABLE shipment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  produce_type TEXT NOT NULL,
  quantity_kg DECIMAL NOT NULL,
  pickup_lat DECIMAL(9,6) NOT NULL,
  pickup_lng DECIMAL(9,6) NOT NULL,
  pickup_province TEXT NOT NULL,
  destination_province TEXT NOT NULL,
  temp_required TEXT, -- e.g., 'chill', 'frozen', 'ambient'
  price_offer_usd DECIMAL NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status shipment_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Available Trips (Drivers posting)
CREATE TABLE available_trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  from_province TEXT NOT NULL,
  to_province TEXT NOT NULL,
  truck_type TEXT NOT NULL, -- e.g., '1-ton Ref', '5-ton Ref'
  capacity_kg DECIMAL NOT NULL,
  available_from TIMESTAMPTZ NOT NULL,
  available_to TIMESTAMPTZ NOT NULL,
  price_per_kg DECIMAL,
  status trip_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipment_requests(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES available_trips(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  farmer_id UUID REFERENCES users(id),
  status match_status DEFAULT 'pending',
  commission_percent DECIMAL DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (Realtime Chat)
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) - basic template
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON shipment_requests FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON available_trips FOR SELECT USING (true);
CREATE POLICY "Allow members read" ON matches FOR SELECT USING (auth.uid() = driver_id OR auth.uid() = farmer_id);
CREATE POLICY "Allow members read" ON messages FOR SELECT USING (auth.uid() IN (SELECT driver_id FROM matches WHERE id=match_id) OR auth.uid() IN (SELECT farmer_id FROM matches WHERE id=match_id));

-- Add insert policies as needed
