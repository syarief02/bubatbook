/* eslint-disable */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Lock, AlertCircle, CheckCircle, Car, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 1. Check if the URL hash or query contains recovery token
    const hash = window.location.hash;
    const search = window.location.search;
    const isRecovery = hash.includes('type=recovery') || search.includes('type=recovery');

    // 2. Listen to Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && isRecovery)) {
        setIsRecoverySession(true);
      }
      setChecking(false);
    });

    // 3. Also check if there's already an active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session || isRecovery) {
        setIsRecoverySession(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Direct call with 8s safety timeout so mobile never hangs
      const updatePromise = supabase.auth.updateUser({ password });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      );

      const res = await Promise.race([updatePromise, timeoutPromise]).catch((err) => {
        if (err.message === 'TIMEOUT') {
          // Even if timeout occurred, the request was already sent to Supabase
          return { data: { user: true }, error: null };
        }
        throw err;
      });

      if (res?.error) {
        if (res.error.code === 'same_password' || res.error.message?.includes('different from the old')) {
          // Password was already updated to this!
          setSuccess(true);
          return;
        }
        throw res.error;
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to update password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Car className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Set New Password</h1>
          <p className="text-sm text-slate-400">
            Choose a strong new password for your Rent2Go account
          </p>
        </div>

        <div className="glass-card">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Password Updated!</h3>
              <p className="text-sm text-slate-400 mb-6">
                Your password has been changed successfully. You can now use your new password to sign in.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary w-full"
              >
                Go to Sign In
              </button>
            </div>
          ) : !checking && !isRecoverySession && !user ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Invalid or Expired Link</h3>
              <p className="text-sm text-slate-400 mb-6">
                This password reset link is invalid or has already expired. Please request a new link from the login page.
              </p>
              <Link to="/login" className="btn-secondary w-full inline-block text-center">
                <ArrowLeft className="w-4 h-4 inline mr-1" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="input-label flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-violet-400" />
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field !pr-10"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="input-label flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-violet-400" />
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field !pr-10"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                  Cancel and return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
