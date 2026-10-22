import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ilikeAny } from '../utils/search';
import {
  BOOKED_STATUSES,
  chargesCollected,
  chargesOwed,
  depositHeld,
  rentalPaid,
  sumBy,
} from '../utils/revenue';

// ─── Fleet-scoped helper ───
// Applies fleet_group_id filter unless null (super admin "All Fleets" view)
function scopeToFleet(query, fleetId) {
  if (fleetId) return query.eq('fleet_group_id', fleetId);
  return query;
}

// Abandoned checkouts stay HOLD until something expires them; do it before
// counting or listing so admins don't see stale holds. Best-effort only.
async function expireStaleHoldsQuietly() {
  try {
    await supabase.rpc('bubatrent_expire_stale_holds');
  } catch {
    // listing must still work if this fails
  }
}

// Matches no row: for .in() with an empty list
const NO_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Customers' credit by fleet: credit is money a fleet owes the customer, so it
 * is only ever with one fleet (see bubatrent_fleet_credit). Sums the credit
 * ledger, which admins see for their own fleets only. Returns
 * { "<user_id>:<fleet_group_id>": balance }.
 */
export async function fetchFleetCredits(fleetId, userIds = null) {
  let query = supabase
    .from('bubatrent_booking_credit_transactions')
    .select('user_id, fleet_group_id, amount');
  query = scopeToFleet(query, fleetId);
  if (userIds) query = query.in('user_id', userIds.length ? userIds : [NO_ID]);
  const { data, error } = await query;
  if (error) throw error;
  const balances = {};
  for (const t of data || []) {
    const key = `${t.user_id}:${t.fleet_group_id}`;
    balances[key] = (balances[key] || 0) + Number(t.amount || 0);
  }
  return balances;
}

/** A customer's credit with one fleet, from fetchFleetCredits' result. */
export function creditWith(balances, userId, fleetId) {
  return Math.max(0, Math.round((balances[`${userId}:${fleetId}`] || 0) * 100) / 100);
}

// ─── Data-Fetching Hooks (React Query) ───

export function useAdminStats(fleetId) {
  const { data: stats = null, isLoading: loading } = useQuery({
    queryKey: ['admin-stats', fleetId],
    queryFn: async () => {
      await expireStaleHoldsQuietly();
      let bQuery = supabase
        .from('bubatrent_booking_bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED']);
      let bActiveQuery = supabase
        .from('bubatrent_booking_bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP']);
      let bExpiredQuery = supabase
        .from('bubatrent_booking_bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['EXPIRED', 'CANCELLED']);
      let cQuery = supabase
        .from('bubatrent_booking_cars')
        .select('*', { count: 'exact', head: true });
      // Deposit receipts waiting for an admin to check them
      let depReviewQuery = supabase
        .from('bubatrent_booking_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'DEPOSIT_PAID')
        .eq('deposit_status', 'uploaded');
      // Customers who sent their IC/licence and wait for verification (same
      // rule as the "Pending" filter on the Customers page). Customers are
      // shared across fleets, so this isn't fleet-scoped.
      const pendQuery = supabase
        .from('bubatrent_booking_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')
        .eq('is_verified', false)
        .or('ic_number.not.is.null,ic_file_path.not.is.null');
      // Rent received and deposits held (see utils/revenue.js)
      let moneyQuery = supabase
        .from('bubatrent_booking_bookings')
        .select(
          'status, total_price, rent_paid, full_payment_status, deposit_amount, deposit_status, deposit_credited_at, deposit_on_hold, charges_total, amount_owed'
        )
        .in('status', BOOKED_STATUSES);

      bQuery = scopeToFleet(bQuery, fleetId);
      bActiveQuery = scopeToFleet(bActiveQuery, fleetId);
      bExpiredQuery = scopeToFleet(bExpiredQuery, fleetId);
      cQuery = scopeToFleet(cQuery, fleetId);
      depReviewQuery = scopeToFleet(depReviewQuery, fleetId);
      moneyQuery = scopeToFleet(moneyQuery, fleetId);

      const [
        { count: totalBookings },
        { count: activeBookings },
        { count: expiredBookings },
        { count: totalCars },
        { count: pendingVerifications },
        { count: depositsToReview },
        { count: totalCustomers },
      ] = await Promise.all([
        bQuery,
        bActiveQuery,
        bExpiredQuery,
        cQuery,
        pendQuery,
        depReviewQuery,
        supabase
          .from('bubatrent_booking_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'customer'),
      ]);

      const { data: moneyRows, error: moneyErr } = await moneyQuery;
      if (moneyErr) throw moneyErr;

      // Returned cars whose deposit is on hold until the damage cost is known
      const onHold = (moneyRows || []).filter((b) => b.status === 'RETURNED' && b.deposit_on_hold);
      // Licence renewals waiting for review (customers aren't fleet-scoped)
      const { count: renewalsToReview } = await supabase
        .from('bubatrent_booking_verification_updates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      // Credit customers hold with this fleet (returned deposits), to refund by
      // transfer or keep. Another fleet's credit is that fleet's to settle.
      const creditOwedRows = Object.entries(await fetchFleetCredits(fleetId)).filter(
        ([, balance]) => balance > 0
      );

      return {
        totalBookings: totalBookings || 0,
        activeBookings: activeBookings || 0,
        expiredBookings: expiredBookings || 0,
        totalCars: totalCars || 0,
        pendingVerifications: pendingVerifications || 0,
        depositsToReview: depositsToReview || 0,
        rentalRevenue: sumBy(moneyRows || [], rentalPaid),
        depositsHeld: sumBy(moneyRows || [], depositHeld),
        chargesCollected: sumBy(moneyRows || [], chargesCollected),
        chargesOwed: sumBy(moneyRows || [], chargesOwed),
        renewalsToReview: renewalsToReview || 0,
        depositsOnHold: onHold.length,
        depositsOnHoldAmount: sumBy(onHold, (b) => Number(b.deposit_amount) || 0),
        customersWithCredit: new Set(creditOwedRows.map(([key]) => key.split(':')[0])).size,
        creditOwed: sumBy(creditOwedRows, ([, balance]) => balance),
        totalCustomers: totalCustomers || 0,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 min cache
  });

  return { stats, loading };
}

export function useAdminBookings(filters = {}) {
  const {
    data: bookings = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['admin-bookings', filters.status, filters.carId, filters.fleetId],
    queryFn: async () => {
      await expireStaleHoldsQuietly();
      let query = supabase
        .from('bubatrent_booking_bookings')
        .select('*, bubatrent_booking_cars(name, brand, model, image_url)')
        .order('created_at', { ascending: false });

      query = scopeToFleet(query, filters.fleetId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.carId) {
        query = query.eq('car_id', filters.carId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      return data || [];
    },
    staleTime: 60 * 1000, // 1 min cache
  });

  return { bookings, loading, error: queryError?.message || null, refetch };
}

export function useAdminCars(fleetId) {
  const {
    data: cars = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['admin-cars', fleetId],
    queryFn: async () => {
      let query = supabase
        .from('bubatrent_booking_cars')
        .select('*')
        .order('created_at', { ascending: false });

      query = scopeToFleet(query, fleetId);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 min cache
  });

  return { cars, loading, error: queryError?.message || null, refetch };
}

// Road tax, insurance, Puspakom and GPS renewals of the fleet's cars, newest
// expiry first (see utils/carDocuments.js)
export function useCarDocuments(fleetId) {
  const {
    data: documents = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['car-documents', fleetId],
    queryFn: async () => {
      let query = supabase
        .from('bubatrent_booking_car_documents')
        .select('*')
        .order('valid_until', { ascending: false });

      query = scopeToFleet(query, fleetId);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 min cache
  });

  return { documents, loading, error: queryError?.message || null, refetch };
}

/** The fleet's admins and staff with their WhatsApp numbers, to pick a car's contact. */
export function useFleetContacts(fleetId) {
  const { data: contacts = [], refetch } = useQuery({
    queryKey: ['fleet-contacts', fleetId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bubatrent_fleet_contacts', {
        p_fleet_group_id: fleetId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!fleetId,
    staleTime: 2 * 60 * 1000, // 2 min cache
  });

  return { contacts, refetch };
}

/** The signed-in admin's own WhatsApp number (digits, e.g. 60123456789), or null. */
export function useMyWhatsapp(userId) {
  const {
    data: whatsapp = null,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ['my-whatsapp', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bubatrent_booking_admin_contacts')
        .select('whatsapp')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.whatsapp || null;
    },
    enabled: !!userId,
  });

  return { whatsapp, loading, refetch };
}

// The database adds the country code to a local number (012… → 6012…) and
// writes the audit log entry. An empty number clears it.
export async function setMyWhatsapp(number) {
  const { data, error } = await supabase.rpc('bubatrent_admin_set_my_whatsapp', {
    p_whatsapp: number,
  });
  if (error) throw error;
  return data;
}

/**
 * Fetches customer list.
 * - Default (role='ALL'): only shows customers (excludes admin/super_admin)
 * - Specific role filter: shows that role
 * - Verification filter: 'verified', 'not_verified', 'pending'
 * - Booking counts scoped to fleet when fleetId provided
 */
export function useAdminCustomers(filters = {}) {
  const {
    data: customers = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [
      'admin-customers',
      filters.role,
      filters.search,
      filters.fleetId,
      filters.verification,
      filters.credit,
    ],
    queryFn: async () => {
      let query = supabase
        .from('bubatrent_booking_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Role filter — 'ALL' shows everyone including admins
      if (filters.role && filters.role !== 'ALL') {
        query = query.eq('role', filters.role.toLowerCase());
      }

      // Search filter
      if (filters.search) {
        if (filters.search.trim()) {
          query = query.or(ilikeAny(['display_name', 'username', 'phone'], filters.search));
        }
      }

      // Verification filter
      if (filters.verification === 'verified') {
        query = query.eq('is_verified', true);
      } else if (filters.verification === 'not_verified') {
        query = query.eq('is_verified', false).is('ic_number', null).is('ic_file_path', null);
      } else if (filters.verification === 'pending') {
        query = query.eq('is_verified', false).or('ic_number.not.is.null,ic_file_path.not.is.null');
      }

      // Licence renewals / document updates waiting for review (Verify Account)
      const { data: pendingUpdates } = await supabase
        .from('bubatrent_booking_verification_updates')
        .select('user_id')
        .eq('status', 'pending');
      const updateWaiting = new Set((pendingUpdates || []).map((u) => u.user_id));
      if (filters.verification === 'renewal') {
        query = query.in('id', updateWaiting.size ? [...updateWaiting] : [NO_ID]);
      }

      // Customers holding credit (deposits returned as credit, to refund or keep)
      if (filters.credit) {
        query = query.gt('deposit_credit', 0);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Filter out expired-licence "verified" customers if needed
      let filtered = data || [];
      if (filters.verification === 'verified') {
        filtered = filtered.filter(
          (c) => !c.licence_expiry || new Date(c.licence_expiry) >= new Date()
        );
      }

      // Get booking counts — fleet-scoped
      const customerIds = filtered.map((c) => c.id);
      let bookingCounts = {};
      if (customerIds.length > 0) {
        let bQuery = supabase
          .from('bubatrent_booking_bookings')
          .select('user_id, id')
          .in('user_id', customerIds);
        bQuery = scopeToFleet(bQuery, filters.fleetId);
        const { data: bookings } = await bQuery;
        (bookings || []).forEach((b) => {
          bookingCounts[b.user_id] = (bookingCounts[b.user_id] || 0) + 1;
        });
      }

      // Each customer's credit with this fleet (credit is always with one fleet)
      const credits =
        customerIds.length > 0 && filters.fleetId
          ? await fetchFleetCredits(filters.fleetId, customerIds)
          : {};

      const rows = filtered.map((c) => ({
        ...c,
        booking_count: bookingCounts[c.id] || 0,
        update_waiting: updateWaiting.has(c.id),
        fleet_credit: filters.fleetId
          ? creditWith(credits, c.id, filters.fleetId)
          : Number(c.deposit_credit || 0),
      }));
      // "Has credit": with this fleet
      return filters.credit && filters.fleetId ? rows.filter((c) => c.fleet_credit > 0) : rows;
    },
    staleTime: 60 * 1000, // 1 min cache
  });

  return { customers, loading, error: queryError?.message || null, refetch };
}

// ─── Mutation Functions (unchanged — called imperatively) ───

export async function createCar(carData) {
  const { data, error } = await supabase
    .from('bubatrent_booking_cars')
    .insert(carData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCar(carId, carData) {
  const { data, error } = await supabase
    .from('bubatrent_booking_cars')
    .update({ ...carData, updated_at: new Date().toISOString() })
    .eq('id', carId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCar(carId) {
  const { error } = await supabase.from('bubatrent_booking_cars').delete().eq('id', carId);

  if (error) throw error;
}

// The database checks the status rules, stamps updated_at and writes the
// audit log entry.
export async function updateBookingStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bubatrent_booking_bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBookingDocuments(bookingId, adminId) {
  await supabase.from('bubatrent_booking_audit_logs').insert({
    admin_id: adminId,
    action: 'VIEW_DOCUMENTS',
    resource_type: 'booking',
    resource_id: bookingId,
    details: { timestamp: new Date().toISOString() },
  });

  const { data, error } = await supabase
    .from('bubatrent_booking_customer_documents')
    .select('*')
    .eq('booking_id', bookingId);

  if (error) throw error;
  return data || [];
}

export async function verifyDocument(documentId, adminId) {
  const { data, error } = await supabase
    .from('bubatrent_booking_customer_documents')
    .update({ verified_by: adminId, verified_at: new Date().toISOString() })
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('bubatrent_booking_audit_logs').insert({
    admin_id: adminId,
    action: 'VERIFY_DOCUMENT',
    resource_type: 'document',
    resource_id: documentId,
    details: { timestamp: new Date().toISOString() },
  });
  return data;
}

export async function getAuditLogs(bookingId) {
  const { data, error } = await supabase
    .from('bubatrent_booking_audit_logs')
    .select('*, bubatrent_booking_profiles(display_name, username)')
    .eq('resource_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ─── Customer Management ───

export async function updateUserRole(userId, newRole, adminId) {
  console.log('[updateUserRole] userId:', userId, 'newRole:', newRole, 'by:', adminId);

  const { error } = await supabase
    .from('bubatrent_booking_profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) {
    console.error('[updateUserRole] Update failed:', error);
    throw error;
  }
  await supabase.from('bubatrent_booking_audit_logs').insert({
    admin_id: adminId,
    action: 'CHANGE_ROLE',
    resource_type: 'profile',
    resource_id: userId,
    details: { new_role: newRole, timestamp: new Date().toISOString() },
  });
  console.log('[updateUserRole] Success');
  return { ok: true };
}

export async function getCustomerBookings(userId, fleetId) {
  let query = supabase
    .from('bubatrent_booking_bookings')
    .select('*, bubatrent_booking_cars(name, brand, model, image_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  query = scopeToFleet(query, fleetId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function verifyCustomer(userId, adminId) {
  console.log('[verifyCustomer] userId:', userId, 'by:', adminId);

  const { error } = await supabase
    .from('bubatrent_booking_profiles')
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: adminId,
    })
    .eq('id', userId);

  if (error) {
    console.error('[verifyCustomer] Failed:', error);
    throw error;
  }
  await supabase.from('bubatrent_booking_audit_logs').insert({
    admin_id: adminId,
    action: 'VERIFY_CUSTOMER',
    resource_type: 'profile',
    resource_id: userId,
    details: { timestamp: new Date().toISOString() },
  });
  console.log('[verifyCustomer] Success');
  return { ok: true };
}

export async function unverifyCustomer(userId, adminId) {
  console.log('[unverifyCustomer] userId:', userId, 'by:', adminId);

  const { error } = await supabase
    .from('bubatrent_booking_profiles')
    .update({
      is_verified: false,
      verified_at: null,
      verified_by: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[unverifyCustomer] Failed:', error);
    throw error;
  }
  await supabase.from('bubatrent_booking_audit_logs').insert({
    admin_id: adminId,
    action: 'UNVERIFY_CUSTOMER',
    resource_type: 'profile',
    resource_id: userId,
    details: { timestamp: new Date().toISOString() },
  });
  console.log('[unverifyCustomer] Success');
  return { ok: true };
}

/**
 * Reject a pending verification — clears all docs and IC fields,
 * forcing the customer to re-submit from scratch.
 */
export async function rejectVerification(userId, adminId, reason = '') {
  console.log('[rejectVerification] userId:', userId, 'by:', adminId, 'reason:', reason);

  const { error } = await supabase
    .from('bubatrent_booking_profiles')
    .update({
      ic_number: null,
      ic_file_path: null,
      licence_file_path: null,
      licence_expiry: null,
      is_verified: false,
      verified_at: null,
      verified_by: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[rejectVerification] Failed:', error);
    throw error;
  }
  await supabase.from('bubatrent_booking_audit_logs').insert({
    admin_id: adminId,
    action: 'REJECT_VERIFICATION',
    resource_type: 'profile',
    resource_id: userId,
    details: { reason, timestamp: new Date().toISOString() },
  });
  console.log('[rejectVerification] Success');
  return { ok: true };
}
