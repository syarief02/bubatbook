import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useBookings(userId) {
  const {
    data: bookings = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['bookings', userId],
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from('bubatrent_booking_bookings')
        .select('*, bubatrent_booking_cars(name, brand, model, image_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 min cache
  });

  return { bookings, loading, error: queryError?.message || null, refetch };
}

/**
 * Mark abandoned checkouts (HOLD past hold_expires_at) as EXPIRED for all users,
 * so they stop blocking the dates. Call before admin-created bookings or date edits.
 */
export async function expireStaleHolds() {
  const { error } = await supabase.rpc('bubatrent_expire_stale_holds');
  if (error) throw error;
}

/**
 * Hold a car for 10 minutes while the customer checks out.
 * The server computes price and deposit from the car's daily rate and rejects
 * overlapping dates, so two customers can never hold the same car and day.
 */
export async function createHoldBooking(carId, pickupDate, returnDate) {
  const { data, error } = await supabase.rpc('bubatrent_create_hold_booking', {
    p_car_id: carId,
    p_pickup: pickupDate,
    p_return: returnDate,
  });

  if (error) throw error;
  return data;
}

/**
 * Atomically mark the deposit paid, record the payment and apply any credit.
 * receiptPath may be null only when credit covers the whole deposit.
 */
export async function submitBookingDeposit(bookingId, receiptPath) {
  const { data, error } = await supabase.rpc('bubatrent_submit_booking_deposit', {
    p_booking_id: bookingId,
    p_receipt_path: receiptPath,
  });

  if (error) throw error;
  return data;
}

export async function updateBookingCustomerInfo(bookingId, customerInfo) {
  const { data, error } = await supabase
    .from('bubatrent_booking_bookings')
    .update({
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      notes: customerInfo.notes || '',
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBooking(bookingId) {
  const { data, error } = await supabase
    .from('bubatrent_booking_bookings')
    .select('*, bubatrent_booking_cars(*), bubatrent_booking_payments(*)')
    .eq('id', bookingId)
    .single();

  if (error) throw error;
  return data;
}

export async function cancelBooking(bookingId, userId) {
  let query = supabase
    .from('bubatrent_booking_bookings')
    .update({ status: 'CANCELLED' })
    .eq('id', bookingId);

  // If userId provided, enforce ownership (customer path)
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  return data;
}
