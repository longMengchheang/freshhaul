CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'rejected');
CREATE TYPE dispute_resolution AS ENUM ('driver_favored', 'farmer_favored', 'buyer_favored', 'split_decision', 'manual_review');

CREATE TABLE transport_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  opened_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  evidence_notes TEXT,
  status dispute_status NOT NULL DEFAULT 'open',
  auto_resolution dispute_resolution,
  auto_confidence NUMERIC(5, 2),
  auto_summary TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE dispute_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES transport_disputes(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE transport_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow participants to read disputes" ON transport_disputes
  FOR SELECT TO authenticated
  USING (
    auth.uid() = opened_by
    OR auth.uid() = respondent_id
    OR auth.uid() IN (SELECT buyer_id FROM deals WHERE id = deal_id)
    OR auth.uid() IN (SELECT farmer_id FROM deals WHERE id = deal_id)
    OR auth.uid() IN (SELECT driver_id FROM matches WHERE id = match_id)
  );

CREATE POLICY "Allow participants to open disputes" ON transport_disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = opened_by
    AND (
      auth.uid() IN (SELECT buyer_id FROM deals WHERE id = deal_id)
      OR auth.uid() IN (SELECT farmer_id FROM deals WHERE id = deal_id)
      OR auth.uid() IN (SELECT driver_id FROM matches WHERE id = match_id)
    )
  );

ALTER TABLE dispute_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow participants to read dispute events" ON dispute_events
  FOR SELECT TO authenticated
  USING (
    auth.uid() = actor_id
    OR auth.uid() IN (
      SELECT opened_by FROM transport_disputes WHERE id = dispute_id
      UNION
      SELECT respondent_id FROM transport_disputes WHERE id = dispute_id
    )
  );

CREATE POLICY "Allow participants to insert dispute events" ON dispute_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = actor_id
    AND auth.uid() IN (
      SELECT opened_by FROM transport_disputes WHERE id = dispute_id
      UNION
      SELECT respondent_id FROM transport_disputes WHERE id = dispute_id
    )
  );

CREATE INDEX idx_transport_disputes_deal_id ON transport_disputes(deal_id);
CREATE INDEX idx_transport_disputes_status ON transport_disputes(status);
CREATE INDEX idx_transport_disputes_opened_by ON transport_disputes(opened_by);
CREATE INDEX idx_dispute_events_dispute_id ON dispute_events(dispute_id);
CREATE INDEX idx_dispute_events_created_at ON dispute_events(created_at DESC);
