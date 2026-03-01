-- =====================================================
-- Super Group Governance + Suspension Mode Migration
-- =====================================================

-- 1) Add governance columns to fleet_groups
ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  is_super_group BOOLEAN DEFAULT false;

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  status TEXT DEFAULT 'PENDING_VERIFICATION';

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  verified_at TIMESTAMPTZ;

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  verified_by UUID REFERENCES auth.users(id);

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  rejection_reason TEXT;

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  suspended_at TIMESTAMPTZ;

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  suspended_by UUID REFERENCES auth.users(id);

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  suspension_reason TEXT;

ALTER TABLE bubatrent_booking_fleet_groups ADD COLUMN IF NOT EXISTS
  suspension_notes TEXT;

-- 2) Create change_requests table
CREATE TABLE IF NOT EXISTS bubatrent_booking_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_group_id UUID NOT NULL REFERENCES bubatrent_booking_fleet_groups(id),
  customer_id UUID NOT NULL REFERENCES bubatrent_booking_profiles(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  changes JSONB NOT NULL,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Backfill BuBat Resources as Super Group + VERIFIED
UPDATE bubatrent_booking_fleet_groups
SET is_super_group = true,
    status = 'VERIFIED',
    verified_at = now()
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_change_requests_fleet ON bubatrent_booking_change_requests(fleet_group_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_customer ON bubatrent_booking_change_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON bubatrent_booking_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_fleet_groups_status ON bubatrent_booking_fleet_groups(status);

-- 5) RLS on change_requests
ALTER TABLE bubatrent_booking_change_requests ENABLE ROW LEVEL SECURITY;

-- Super admins can see all change requests
CREATE POLICY "Super admins can manage all change requests" ON bubatrent_booking_change_requests
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM bubatrent_booking_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Fleet admins can see their own group's change requests
CREATE POLICY "Fleet admins can view own group change requests" ON bubatrent_booking_change_requests
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM bubatrent_booking_fleet_memberships m
      WHERE m.fleet_group_id = bubatrent_booking_change_requests.fleet_group_id
      AND m.user_id = auth.uid()
    )
  );

-- Fleet admins can insert change requests for their group
CREATE POLICY "Fleet admins can create change requests" ON bubatrent_booking_change_requests
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM bubatrent_booking_fleet_memberships m
      WHERE m.fleet_group_id = bubatrent_booking_change_requests.fleet_group_id
      AND m.user_id = auth.uid()
    )
  );
