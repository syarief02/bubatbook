-- =====================================================================
-- Fix schema drift between the app and the live database (2026-10-11)
--
-- The repo's migration_overhaul.sql and add_fleet_groups.sql used
-- CREATE TABLE IF NOT EXISTS, so where an older table already existed
-- the intended columns and foreign keys were never created:
--   * Expense claims/images use different column names than the app,
--     so every expense insert failed (both tables are still empty).
--   * fleet_memberships has no foreign keys, so the API cannot embed the
--     fleet group or profile and fleet admins never get their fleets.
--   * audit_logs.admin_id references auth.users rather than profiles, so
--     the booking audit history (which embeds the admin's profile) fails.
--
-- Safe to run before or after 20261011120000_security_lockdown_and_booking_integrity.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Expense claims: add the columns the app writes
-- ---------------------------------------------------------------------
alter table public.bubatrent_booking_expense_claims
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists expense_date date,
  add column if not exists total_amount numeric(10, 2),
  add column if not exists payment_receipt_path text,
  add column if not exists completed_by uuid references auth.users(id),
  add column if not exists completed_at timestamptz;

-- Legacy columns the app never sets; required values made every insert fail.
alter table public.bubatrent_booking_expense_claims alter column title drop not null;
alter table public.bubatrent_booking_expense_claims alter column amount drop not null;

-- ---------------------------------------------------------------------
-- 2. Expense images: match the app's column names; delete with the claim
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bubatrent_booking_expense_images'
       and column_name = 'expense_id'
  ) then
    alter table public.bubatrent_booking_expense_images rename column expense_id to claim_id;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bubatrent_booking_expense_images'
       and column_name = 'image_path'
  ) then
    alter table public.bubatrent_booking_expense_images rename column image_path to file_path;
  end if;
end $$;

alter table public.bubatrent_booking_expense_images
  drop constraint if exists bubatrent_booking_expense_images_expense_id_fkey;
alter table public.bubatrent_booking_expense_images
  drop constraint if exists bubatrent_booking_expense_images_claim_id_fkey;
alter table public.bubatrent_booking_expense_images
  add constraint bubatrent_booking_expense_images_claim_id_fkey
  foreign key (claim_id) references public.bubatrent_booking_expense_claims(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 3. Fleet memberships: foreign keys the app relies on for embedding
-- ---------------------------------------------------------------------
-- Memberships whose fleet group no longer exists would have been removed
-- by ON DELETE CASCADE under the intended schema.
delete from public.bubatrent_booking_fleet_memberships m
 where not exists (
   select 1 from public.bubatrent_booking_fleet_groups g where g.id = m.fleet_group_id
 );
delete from public.bubatrent_booking_fleet_memberships m
 where not exists (
   select 1 from public.bubatrent_booking_profiles p where p.id = m.user_id
 );

alter table public.bubatrent_booking_fleet_memberships
  drop constraint if exists bubatrent_booking_fleet_memberships_fleet_group_id_fkey;
alter table public.bubatrent_booking_fleet_memberships
  add constraint bubatrent_booking_fleet_memberships_fleet_group_id_fkey
  foreign key (fleet_group_id) references public.bubatrent_booking_fleet_groups(id) on delete cascade;

alter table public.bubatrent_booking_fleet_memberships
  drop constraint if exists bubatrent_booking_fleet_memberships_user_id_fkey;
alter table public.bubatrent_booking_fleet_memberships
  add constraint bubatrent_booking_fleet_memberships_user_id_fkey
  foreign key (user_id) references public.bubatrent_booking_profiles(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 4. Audit logs: link the admin to their profile (kept if they are deleted)
-- ---------------------------------------------------------------------
alter table public.bubatrent_booking_audit_logs
  drop constraint if exists bubatrent_booking_audit_logs_admin_profile_fkey;
alter table public.bubatrent_booking_audit_logs
  add constraint bubatrent_booking_audit_logs_admin_profile_fkey
  foreign key (admin_id) references public.bubatrent_booking_profiles(id) on delete set null;

commit;
