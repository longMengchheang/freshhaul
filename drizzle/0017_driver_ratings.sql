-- Driver Rating & Reputation System Migration
-- Enables farmers/buyers to rate drivers and track reputation

CREATE TYPE rating_category AS ENUM ('speed', 'communication', 'vehicle_condition', 'professionalism', 'reliability');

-- Driver ratings (one entry per trip completion)
CREATE TABLE driver_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rater_role TEXT NOT NULL CHECK (rater_role IN ('farmer', 'buyer')),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  speed_rating INTEGER CHECK (speed_rating >= 1 AND speed_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  vehicle_condition_rating INTEGER CHECK (vehicle_condition_rating >= 1 AND vehicle_condition_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  reliability_rating INTEGER CHECK (reliability_rating >= 1 AND reliability_rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Aggregated driver reputation (updated periodically)
CREATE TABLE driver_reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_ratings INTEGER DEFAULT 0,
  average_rating NUMERIC(3, 2) DEFAULT 0.00,
  average_speed NUMERIC(3, 2) DEFAULT 0.00,
  average_communication NUMERIC(3, 2) DEFAULT 0.00,
  average_vehicle_condition NUMERIC(3, 2) DEFAULT 0.00,
  average_professionalism NUMERIC(3, 2) DEFAULT 0.00,
  average_reliability NUMERIC(3, 2) DEFAULT 0.00,
  rating_count_5_star INTEGER DEFAULT 0,
  rating_count_4_star INTEGER DEFAULT 0,
  rating_count_3_star INTEGER DEFAULT 0,
  rating_count_2_star INTEGER DEFAULT 0,
  rating_count_1_star INTEGER DEFAULT 0,
  reputation_badge VARCHAR(50),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reputation badges based on thresholds (calculated dynamically)
CREATE TABLE reputation_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_name VARCHAR(50) NOT NULL UNIQUE,
  min_rating NUMERIC(3, 2) NOT NULL,
  min_total_ratings INTEGER NOT NULL,
  badge_icon TEXT,
  badge_color VARCHAR(20),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default badges
INSERT INTO reputation_badges (badge_name, min_rating, min_total_ratings, badge_color, description) VALUES
  ('Trusted Pro', 4.8, 50, 'gold', 'Exceptional service with 4.8+ stars from 50+ trips'),
  ('Reliable Driver', 4.5, 20, 'silver', 'Consistent quality with 4.5+ stars from 20+ trips'),
  ('Rising Star', 4.2, 5, 'blue', 'Strong performance with 4.2+ stars from 5+ trips'),
  ('New Driver', 0, 0, 'gray', 'Recently joined the platform')
ON CONFLICT DO NOTHING;

-- Row-level security policies
ALTER TABLE driver_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anyone to read ratings" ON driver_ratings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow rater to write ratings" ON driver_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rater_id);

ALTER TABLE driver_reputation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anyone to read reputation" ON driver_reputation_scores
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE reputation_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anyone to read badges" ON reputation_badges
  FOR SELECT TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX idx_driver_ratings_driver_id ON driver_ratings(driver_id);
CREATE INDEX idx_driver_ratings_rater_id ON driver_ratings(rater_id);
CREATE INDEX idx_driver_ratings_deal_id ON driver_ratings(deal_id);
CREATE INDEX idx_driver_ratings_created_at ON driver_ratings(created_at DESC);
CREATE INDEX idx_driver_reputation_scores_driver_id ON driver_reputation_scores(driver_id);
CREATE INDEX idx_driver_reputation_scores_average_rating ON driver_reputation_scores(average_rating DESC);
CREATE INDEX idx_driver_reputation_scores_total_ratings ON driver_reputation_scores(total_ratings DESC);
