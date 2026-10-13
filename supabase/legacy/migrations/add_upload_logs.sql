-- Upload debug logs table
-- Stores step-by-step upload progress for debugging mobile upload issues

CREATE TABLE IF NOT EXISTS bubatrent_booking_upload_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id uuid,
  step text NOT NULL,           -- preflight, reading_file, uploading, progress, success, error, timeout, network_error
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',  -- file_size, file_type, bucket, path, browser, error details
  created_at timestamptz DEFAULT now()
);

-- Index for fast queries by time and step
CREATE INDEX idx_upload_logs_created_at ON bubatrent_booking_upload_logs(created_at DESC);
CREATE INDEX idx_upload_logs_step ON bubatrent_booking_upload_logs(step);
CREATE INDEX idx_upload_logs_user_id ON bubatrent_booking_upload_logs(user_id);

-- RLS
ALTER TABLE bubatrent_booking_upload_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own logs
CREATE POLICY "Users can insert own upload logs"
  ON bubatrent_booking_upload_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins (super_admin) can read all logs
CREATE POLICY "Admins can read all upload logs"
  ON bubatrent_booking_upload_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bubatrent_booking_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Auto-cleanup: delete logs older than 30 days (can be run as a cron or manually)
-- DELETE FROM bubatrent_booking_upload_logs WHERE created_at < now() - interval '30 days';
