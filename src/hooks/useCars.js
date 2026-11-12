import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { carSlug, isCarId } from '../utils/carLinks';

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

/**
 * A car's long-rental discounts (weekly from 7 days, monthly from 30): its
 * own, else its fleet's; none when the car has long-term bookings off.
 */
async function fetchLongRentalRates(carId) {
  if (!carId) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bubatrent_car_long_rental_rates`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_car_id: carId }),
  });
  // Without the rates the price shows without a discount; the booking itself
  // is priced by the server
  if (!res.ok) return null;
  return res.json();
}

export function useLongRentalRates(carId) {
  const { data = null } = useQuery({
    queryKey: ['long-rental-rates', carId],
    queryFn: () => fetchLongRentalRates(carId),
    enabled: !!carId,
    staleTime: 1000 * 60 * 5,
  });
  return data;
}

/**
 * Who customers WhatsApp about a car: {name, whatsapp} of the admin who
 * looks after it, else the fleet's number. Null when neither has one.
 */
async function fetchCarContact(carId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bubatrent_car_contact`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_car_id: carId }),
  });
  // Callers fall back to the Rent2Go number
  if (!res.ok) return null;
  return res.json();
}

export function useCarContact(carId) {
  const { data = null } = useQuery({
    queryKey: ['car-contact', carId],
    queryFn: () => fetchCarContact(carId),
    enabled: !!carId,
    staleTime: 1000 * 60 * 5,
  });
  return data;
}

/** A car by its id or by its page address (the plate without spaces, e.g. "vjc5290"). */
export function useCar(id) {
  const {
    data: car = null,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['car', id],
    queryFn: async () => {
      if (!isCarId(id) && !/^[a-z0-9]+$/i.test(id)) throw new Error('Car not found');
      // Plates are stored with spaces ("VJC 5290"): ask for any plate with these characters
      // in order, then keep the one that matches exactly
      const filter = isCarId(id)
        ? `id=eq.${id}`
        : `plate_number=ilike.${encodeURIComponent(id.split('').join('*'))}`;
      const url = `${SUPABASE_URL}/rest/v1/bubatrent_booking_cars?${filter}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (!res.ok) throw new Error(`Failed to fetch car: ${res.status}`);
      const data = (await res.json()).filter((c) => isCarId(id) || carSlug(c) === id.toLowerCase());
      if (!data || data.length === 0) throw new Error('Car not found');
      const rates = await fetchLongRentalRates(data[0].id);
      return { ...data[0], long_rental_rates: rates };
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
const NO_BOOKED_DAYS = [];

/**
 * The days a car is taken from today on, for the car page's calendar:
 * [{from_date, to_date}] (YYYY-MM-DD, both days included). Only dates, never
 * who booked. Empty when they can't be loaded: the calendar then greys out
 * nothing, and checkAvailability() still decides.
 */
export function useCarBookedDays(carId) {
  const { data, isLoading } = useQuery({
    queryKey: ['car-booked-days', carId],
    queryFn: async () => {
      const { data: ranges, error } = await supabase.rpc('bubatrent_car_booked_days', {
        p_car_id: carId,
      });
      if (error) return NO_BOOKED_DAYS;
      return ranges || NO_BOOKED_DAYS;
    },
    enabled: !!carId,
    staleTime: 1000 * 60,
  });
  return { ranges: data || NO_BOOKED_DAYS, loading: !!carId && isLoading };
}

export async function checkAvailability(carId, pickupDate, returnDate) {
  const { data, error } = await supabase.rpc('bubatrent_check_availability', {
    p_car_id: carId,
    p_pickup: pickupDate,
    p_return: returnDate,
  });

  if (error) throw error;
  return data === true;
}
