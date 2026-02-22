import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAdminStats() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const [
                    { count: totalBookings },
                    { count: activeBookings },
                    { count: totalCars },
                    { count: pendingVerifications },
                ] = await Promise.all([
                    supabase.from('bubatrent_booking_bookings').select('*', { count: 'exact', head: true }),
                    supabase.from('bubatrent_booking_bookings').select('*', { count: 'exact', head: true }).in('status', ['HOLD', 'PAID', 'CONFIRMED']),
                    supabase.from('bubatrent_booking_cars').select('*', { count: 'exact', head: true }),
                    supabase.from('bubatrent_booking_bookings').select('*', { count: 'exact', head: true }).eq('status', 'PAID'),
                ]);

                // Calculate revenue from completed payments
                const { data: payments } = await supabase
                    .from('bubatrent_booking_payments')
                    .select('amount')
                    .eq('status', 'completed');

                const totalRevenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

                setStats({
                    totalBookings: totalBookings || 0,
                    activeBookings: activeBookings || 0,
                    totalCars: totalCars || 0,
                    pendingVerifications: pendingVerifications || 0,
                    totalRevenue,
                });
            } catch (err) {
                console.error('Error fetching admin stats:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    return { stats, loading };
}

export function useAdminBookings(filters = {}) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('bubatrent_booking_bookings')
                .select('*, bubatrent_booking_cars(name, brand, model, image_url)')
                .order('created_at', { ascending: false });

            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.carId) {
                query = query.eq('car_id', filters.carId);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setBookings(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filters.status, filters.carId]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    return { bookings, loading, error, refetch: fetchBookings };
}

export function useAdminCars() {
    const [cars, setCars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCars = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('bubatrent_booking_cars')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setCars(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCars();
    }, [fetchCars]);

    return { cars, loading, error, refetch: fetchCars };
}

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
    const { error } = await supabase
        .from('bubatrent_booking_cars')
        .delete()
        .eq('id', carId);

    if (error) throw error;
}

export async function updateBookingStatus(bookingId, status) {
    const { data, error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getBookingDocuments(bookingId, adminId) {
    // Log the admin access
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
    await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: adminId,
        action: 'VERIFY_DOCUMENT',
        resource_type: 'document',
        resource_id: documentId,
        details: { timestamp: new Date().toISOString() },
    });

    const { data, error } = await supabase
        .from('bubatrent_booking_customer_documents')
        .update({ verified_by: adminId, verified_at: new Date().toISOString() })
        .eq('id', documentId)
        .select()
        .single();

    if (error) throw error;
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
