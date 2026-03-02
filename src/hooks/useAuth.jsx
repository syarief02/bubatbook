import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useViewAs } from './ViewAsContext';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        }).catch((err) => {
            console.warn('Auth session init failed:', err.message);
            setUser(null);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('bubatrent_booking_profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) throw error;
            setProfile(data);
        } catch (err) {
            console.error('Error fetching profile:', err);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }

    async function refreshProfile() {
        if (user?.id) await fetchProfile(user.id);
    }

    async function signUp(email, password, displayName, phone) {
        const { normalizePhone } = await import('../utils/phoneUtils');
        const normalizedPhone = normalizePhone(phone);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName, phone: normalizedPhone } },
        });
        if (error) throw error;

        // Feature C: check if a manual customer profile exists with same phone
        if (data?.user?.id && normalizedPhone) {
            try {
                const { data: existing } = await supabase
                    .from('bubatrent_booking_profiles')
                    .select('id, phone, created_by_admin, is_verified')
                    .eq('phone', normalizedPhone)
                    .not('created_by_admin', 'is', null)
                    .limit(2);

                if (existing && existing.length === 1) {
                    // Link: update the manual profile's id to this auth user
                    const manualProfile = existing[0];
                    await supabase
                        .from('bubatrent_booking_profiles')
                        .update({
                            id: data.user.id,
                            email: email,
                            display_name: displayName,
                        })
                        .eq('id', manualProfile.id);
                    console.log('Linked signup to existing manual customer profile');
                } else if (existing && existing.length > 1) {
                    console.warn('Multiple manual profiles with same phone — admin needs to resolve duplicates');
                }
            } catch (linkErr) {
                console.warn('Phone linking check failed (non-blocking):', linkErr.message);
            }
        }

        return data;
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    async function resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
    }

    async function signOut() {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Sign out error:', err);
        } finally {
            // Always clear local state even if API fails
            setUser(null);
            setProfile(null);
        }
    }

    const realIsAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    const realIsSuperAdmin = profile?.role === 'super_admin';

    // ViewAs overrides
    let viewAsContext;
    try { viewAsContext = useViewAs(); } catch { viewAsContext = { isViewMode: false, viewAs: null }; }
    const { isViewMode, viewAs } = viewAsContext;

    let isAdmin = realIsAdmin;
    let isSuperAdmin = realIsSuperAdmin;

    if (isViewMode && viewAs) {
        if (viewAs.role === 'customer') {
            isAdmin = false;
            isSuperAdmin = false;
        } else if (viewAs.role === 'group_admin') {
            isAdmin = true;
            isSuperAdmin = false;
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                loading,
                isAdmin,
                isSuperAdmin,
                realIsSuperAdmin,
                isVerified: profile?.is_verified === true && (!profile?.licence_expiry || new Date(profile.licence_expiry) >= new Date()),
                signUp,
                signIn,
                signOut,
                resetPassword,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
