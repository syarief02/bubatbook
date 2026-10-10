import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Fetch cars via direct REST call to bypass Supabase JS client's
 * Navigator LockManager which can hang in multi-tab browsers.
 */
async function fetchCarsREST() {
  const url = `${SUPABASE_URL}/rest/v1/bubatrent_booking_cars?is_available=eq.true&order=created_at.desc&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch cars: ${res.status}`);
  }
  return res.json();
}

export function useCars() {
  const {
    data: cars = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cars'],
    queryFn: fetchCarsREST,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  return { cars, loading, error: error?.message, refetch };
}

export function useCar(id) {
  const {
    data: car = null,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['car', id],
    queryFn: async () => {
      const url = `${SUPABASE_URL}/rest/v1/bubatrent_booking_cars?id=eq.${id}&select=*,bubatrent_booking_fleet_groups(support_whatsapp)`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (!res.ok) throw new Error(`Failed to fetch car: ${res.status}`);
      const data = await res.json();
      if (!data || data.length === 0) throw new Error('Car not found');
      return data[0];
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  return { car, loading, error: error?.message };
}

/**
 * True when no active booking or unexpired hold overlaps the dates.
 * Runs on the server so it sees every customer's bookings, not just the caller's.
 */
export async function checkAvailability(carId, pickupDate, returnDate) {
  const { data, error } = await supabase.rpc('bubatrent_check_availability', {
    p_car_id: carId,
    p_pickup: pickupDate,
    p_return: returnDate,
  });

  if (error) throw error;
  return data === true;
}
