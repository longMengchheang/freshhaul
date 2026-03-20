-- Instant Payout System Migration
-- Enables drivers to withdraw earnings immediately

CREATE TYPE withdrawal_status AS ENUM ('requested', 'processing', 'completed', 'failed', 'cancelled');

-- Driver payment methods (Bakong accounts)
CREATE TABLE driver_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bakong_account_id TEXT NOT NULL UNIQUE,
  account_holder_name TEXT NOT NULL,
  account_holder_phone TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_driver_default_payment UNIQUE (driver_id, is_default) WHERE is_default = true
);

-- Withdrawal requests
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES driver_payment_methods(id) ON DELETE RESTRICT,
  amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd > 0),
  status withdrawal_status NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  bakong_transaction_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Withdrawal execution records
CREATE TABLE withdrawal_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES driver_payment_methods(id) ON DELETE RESTRICT,
  amount_usd NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL,
  bakong_response JSONB,
  error_details JSONB,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Row-level security policies
ALTER TABLE driver_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow driver payment method read" ON driver_payment_methods
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Allow driver payment method write" ON driver_payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow driver withdrawal request read" ON withdrawal_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Allow driver withdrawal request write" ON withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

ALTER TABLE withdrawal_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow driver withdrawal execution read" ON withdrawal_executions
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

-- Indexes for performance
CREATE INDEX idx_driver_payment_methods_driver_id ON driver_payment_methods(driver_id);
CREATE INDEX idx_driver_payment_methods_is_default ON driver_payment_methods(driver_id, is_default);
CREATE INDEX idx_withdrawal_requests_driver_id ON withdrawal_requests(driver_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);
CREATE INDEX idx_withdrawal_executions_driver_id ON withdrawal_executions(driver_id);
CREATE INDEX idx_withdrawal_executions_status ON withdrawal_executions(status);
