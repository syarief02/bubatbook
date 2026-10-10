/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useViewAs } from './ViewAsContext';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = useRef(null);

  useEffect(() => {
    // This callback must stay synchronous and must not call Supabase directly.
    // supabase-js runs it while holding its auth lock (e.g. on every return to
    // the tab, or from the camera/file picker on mobile). Awaiting a query here
    // waits on that same lock and deadlocks every later Supabase request.
    // Deferring with setTimeout lets the lock release first.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      const userChanged = nextUser?.id !== currentUserId.current;
      currentUserId.current = nextUser?.id ?? null;

      setUser((prev) => (prev?.id === nextUser?.id && event !== 'USER_UPDATED' ? prev : nextUser));

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
      } else if (userChanged || event === 'USER_UPDATED') {
        // Hold protected routes on the spinner until the new user's role is known
        if (userChanged) setLoading(true);
        setTimeout(() => fetchProfile(nextUser.id), 0);
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
      if (currentUserId.current === userId) setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (currentUserId.current === userId) setProfile(null);
    } finally {
      if (currentUserId.current === userId) setLoading(false);
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

    // Walk-in customers are not auto-linked by phone number here: an unverified
    // phone number is not proof of identity, so linking would let anyone claim a
    // verified walk-in account. Walk-in customers sign in with "Forgot password"
    // using the email the admin registered for them.
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
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(password) {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });
    if (error) throw error;
    return data;
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
  const viewAsContext = useViewAs();
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
        isVerified:
          profile?.is_verified === true &&
          (!profile?.licence_expiry || new Date(profile.licence_expiry) >= new Date()),
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
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
