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
                    { count: totalCustomers },
                ] = await Promise.all([
                    supabase.from('bubatrent_booking_bookings').select('*', { count: 'exact', head: true }),
                    supabase.from('bubatrent_booking_bookings').select('*', { count: 'exact', head: true }).in('status', ['HOLD', 'PAID', 'CONFIRMED']),
                    supabase.from('bubatrent_booking_cars').select('*', { count: 'exact', head: true }),
                    supabase.from('bubatrent_booking_bookings').select('*', { count: 'exact', head: true }).eq('status', 'PAID'),
                    supabase.from('bubatrent_booking_profiles').select('*', { count: 'exact', head: true }),
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
                    totalCustomers: totalCustomers || 0,
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

// ─── Customer Management ───

export function useAdminCustomers(filters = {}) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCustomers = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('bubatrent_booking_profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters.role && filters.role !== 'ALL') {
                query = query.eq('role', filters.role.toLowerCase());
            }
            if (filters.search) {
                query = query.or(`display_name.ilike.%${filters.search}%,username.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            // Get booking counts for each customer
            const customerIds = (data || []).map(c => c.id);
            let bookingCounts = {};
            if (customerIds.length > 0) {
                const { data: bookings } = await supabase
                    .from('bubatrent_booking_bookings')
                    .select('user_id, id')
                    .in('user_id', customerIds);
                (bookings || []).forEach(b => {
                    bookingCounts[b.user_id] = (bookingCounts[b.user_id] || 0) + 1;
                });
            }

            const enriched = (data || []).map(c => ({
                ...c,
                booking_count: bookingCounts[c.id] || 0,
            }));

            setCustomers(enriched);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filters.role, filters.search]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    return { customers, loading, error, refetch: fetchCustomers };
}

export async function updateUserRole(userId, newRole, adminId) {
    // Log the role change
    await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: adminId,
        action: 'CHANGE_ROLE',
        resource_type: 'profile',
        resource_id: userId,
        details: { new_role: newRole, timestamp: new Date().toISOString() },
    });

    const { data, error } = await supabase
        .from('bubatrent_booking_profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getCustomerBookings(userId) {
    const { data, error } = await supabase
        .from('bubatrent_booking_bookings')
        .select('*, bubatrent_booking_cars(name, brand, model, image_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

