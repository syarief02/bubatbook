import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const HOLD_DURATION_MINUTES = 10;

export function useBookings(userId) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchBookings = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('bubatrent_booking_bookings')
                .select('*, bubatrent_booking_cars(name, brand, model, image_url)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setBookings(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    return { bookings, loading, error, refetch: fetchBookings };
}

export async function expireOldHolds() {
    const now = new Date().toISOString();
    await supabase
        .from('bubatrent_booking_bookings')
        .update({ status: 'EXPIRED' })
        .eq('status', 'HOLD')
        .lt('hold_expires_at', now);
}

export async function createHoldBooking(carId, userId, pickupDate, returnDate, totalPrice, depositAmount) {
    // Clean up expired holds first so exclusion constraint doesn't block valid bookings
    await expireOldHolds();

    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('bubatrent_booking_bookings')
        .insert({
            car_id: carId,
            user_id: userId,
            pickup_date: pickupDate,
            return_date: returnDate,
            total_price: totalPrice,
            deposit_amount: depositAmount,
            status: 'HOLD',
            hold_expires_at: holdExpiresAt,
        })
        .select()
        .single();

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

export async function simulatePayment(bookingId, amount) {
    // Create simulated payment record
    const { error: payError } = await supabase
        .from('bubatrent_booking_payments')
        .insert({
            booking_id: bookingId,
            amount,
            payment_method: 'simulated',
            status: 'completed',
            simulated: true,
            reference_number: `SIM-${Date.now().toString(36).toUpperCase()}`,
        });

    if (payError) throw payError;

    // Update booking status to PAID
    const { data, error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({
            status: 'PAID',
            hold_expires_at: null,
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
