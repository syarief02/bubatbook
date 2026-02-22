import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { expireOldHolds } from './useBookings';

export function useCars() {
    const [cars, setCars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCars = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await supabase
                .from('bubatrent_booking_cars')
                .select('*')
                .eq('is_available', true)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setCars(data || []);
        } catch (err) {
            setError(err.message);
            setCars([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCars();
    }, [fetchCars]);

    return { cars, loading, error, refetch: fetchCars };
}

export function useCar(id) {
    const [car, setCar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;
        async function fetchCar() {
            try {
                setLoading(true);
                const { data, error: fetchError } = await supabase
                    .from('bubatrent_booking_cars')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (fetchError) throw fetchError;
                setCar(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchCar();
    }, [id]);

    return { car, loading, error };
}

export async function checkAvailability(carId, pickupDate, returnDate) {
    // Clean up expired holds first
    await expireOldHolds();

    const { data, error } = await supabase
        .from('bubatrent_booking_bookings')
        .select('id')
        .eq('car_id', carId)
        .in('status', ['HOLD', 'PAID', 'CONFIRMED'])
        .lte('pickup_date', returnDate)
        .gte('return_date', pickupDate);

    if (error) throw error;
    return (data || []).length === 0;
}
