-- =====================================================
-- Multi-Tenant Fleet Groups Migration
-- =====================================================

-- 1) Create fleet_groups table
CREATE TABLE IF NOT EXISTS bubatrent_booking_fleet_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  support_email TEXT,
  support_phone TEXT,
  support_whatsapp TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2) Create fleet_memberships table
CREATE TABLE IF NOT EXISTS bubatrent_booking_fleet_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES bubatrent_booking_profiles(id) ON DELETE CASCADE,
  fleet_group_id UUID NOT NULL REFERENCES bubatrent_booking_fleet_groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('fleet_admin','fleet_staff')) DEFAULT 'fleet_staff',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fleet_group_id)
);

-- 3) Add fleet_group_id columns to existing tables
ALTER TABLE bubatrent_booking_cars
  ADD COLUMN IF NOT EXISTS fleet_group_id UUID REFERENCES bubatrent_booking_fleet_groups(id);

ALTER TABLE bubatrent_booking_bookings
  ADD COLUMN IF NOT EXISTS fleet_group_id UUID REFERENCES bubatrent_booking_fleet_groups(id);

ALTER TABLE bubatrent_booking_payments
  ADD COLUMN IF NOT EXISTS fleet_group_id UUID REFERENCES bubatrent_booking_fleet_groups(id);

ALTER TABLE bubatrent_booking_credit_transactions
  ADD COLUMN IF NOT EXISTS fleet_group_id UUID REFERENCES bubatrent_booking_fleet_groups(id);

ALTER TABLE bubatrent_booking_expense_claims
  ADD COLUMN IF NOT EXISTS fleet_group_id UUID REFERENCES bubatrent_booking_fleet_groups(id);

-- =====================================================
-- Backfill: Create BuBat Resources and assign all data
-- =====================================================

-- Insert BuBat Resources fleet group
INSERT INTO bubatrent_booking_fleet_groups (id, name, slug, support_email, support_phone, support_whatsapp)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'BuBat Resources',
  'bubat-resources',
  'bubatresources@gmail.com',
  '+60 16-256 9733',
  '60162569733'
) ON CONFLICT (name) DO NOTHING;

-- Assign all existing cars to BuBat Resources
UPDATE bubatrent_booking_cars
SET fleet_group_id = 'a0000000-0000-0000-0000-000000000001'
WHERE fleet_group_id IS NULL;

-- Assign all existing bookings to BuBat Resources
UPDATE bubatrent_booking_bookings
SET fleet_group_id = 'a0000000-0000-0000-0000-000000000001'
WHERE fleet_group_id IS NULL;

-- Assign all existing payments to BuBat Resources
UPDATE bubatrent_booking_payments
SET fleet_group_id = 'a0000000-0000-0000-0000-000000000001'
WHERE fleet_group_id IS NULL;

-- Assign all existing credit transactions to BuBat Resources
UPDATE bubatrent_booking_credit_transactions
SET fleet_group_id = 'a0000000-0000-0000-0000-000000000001'
WHERE fleet_group_id IS NULL;

-- Assign all existing expense claims to BuBat Resources
UPDATE bubatrent_booking_expense_claims
SET fleet_group_id = 'a0000000-0000-0000-0000-000000000001'
WHERE fleet_group_id IS NULL;

-- Create fleet memberships for existing admins
-- Syarief (super_admin) -> fleet_admin of BuBat Resources
INSERT INTO bubatrent_booking_fleet_memberships (user_id, fleet_group_id, role)
VALUES ('dfeac68e-f3cf-4013-90da-1926659b2977', 'a0000000-0000-0000-0000-000000000001', 'fleet_admin')
ON CONFLICT (user_id, fleet_group_id) DO NOTHING;

-- Amira (admin) -> fleet_admin of BuBat Resources
INSERT INTO bubatrent_booking_fleet_memberships (user_id, fleet_group_id, role)
VALUES ('c2dc8a51-1c71-4574-bd1f-c2eab63f0151', 'a0000000-0000-0000-0000-000000000001', 'fleet_admin')
ON CONFLICT (user_id, fleet_group_id) DO NOTHING;

-- =====================================================
-- Add NOT NULL constraints after backfill
-- =====================================================
ALTER TABLE bubatrent_booking_cars
  ALTER COLUMN fleet_group_id SET NOT NULL;

ALTER TABLE bubatrent_booking_bookings
  ALTER COLUMN fleet_group_id SET NOT NULL;

-- Create indexes for fleet scoping performance
CREATE INDEX IF NOT EXISTS idx_cars_fleet ON bubatrent_booking_cars(fleet_group_id);
CREATE INDEX IF NOT EXISTS idx_bookings_fleet ON bubatrent_booking_bookings(fleet_group_id);
CREATE INDEX IF NOT EXISTS idx_payments_fleet ON bubatrent_booking_payments(fleet_group_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_fleet ON bubatrent_booking_credit_transactions(fleet_group_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_fleet ON bubatrent_booking_expense_claims(fleet_group_id);
CREATE INDEX IF NOT EXISTS idx_fleet_memberships_user ON bubatrent_booking_fleet_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_fleet_memberships_fleet ON bubatrent_booking_fleet_memberships(fleet_group_id);

-- Enable RLS on new tables
ALTER TABLE bubatrent_booking_fleet_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubatrent_booking_fleet_memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies for fleet_groups (readable by all authenticated)
CREATE POLICY "Fleet groups readable by authenticated users" ON bubatrent_booking_fleet_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Fleet groups insertable by authenticated users" ON bubatrent_booking_fleet_groups
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS policies for fleet_memberships
CREATE POLICY "Users can read own memberships" ON bubatrent_booking_fleet_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can manage memberships" ON bubatrent_booking_fleet_memberships
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM bubatrent_booking_fleet_memberships m
      WHERE m.fleet_group_id = bubatrent_booking_fleet_memberships.fleet_group_id
      AND m.user_id = auth.uid()
      AND m.role = 'fleet_admin'
    )
  );

CREATE POLICY "Super admins can manage all memberships" ON bubatrent_booking_fleet_memberships
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM bubatrent_booking_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
