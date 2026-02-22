import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, AlertCircle, Car, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { signIn, resetPassword, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (user) return <Navigate to="/" replace />;

  // Lockout countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setLockCountdown(0);
        setAttempts(0);
        clearInterval(interval);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`Too many attempts. Try again in ${lockCountdown}s`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      setAttempts(0);
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 30000);
      }
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link');
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
          <h1 className="text-2xl font-bold text-white mb-1">
            {forgotMode ? 'Reset Password' : 'Welcome back'}
          </h1>
          <p className="text-sm text-slate-400">
            {forgotMode ? 'Enter your email to receive a reset link' : 'Sign in to your BubatRent account'}
          </p>
        </div>

        <div className="glass-card">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {forgotMode ? (
            resetSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Check your email</h3>
                <p className="text-sm text-slate-400 mb-6">We've sent a password reset link to <strong className="text-white">{email}</strong></p>
                <button onClick={() => { setForgotMode(false); setResetSent(false); }} className="btn-secondary text-sm">
                  <ArrowLeft className="w-4 h-4 inline mr-1" />
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="input-label flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-violet-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@email.com"
                    required
                    disabled={loading}
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <button type="button" onClick={() => { setForgotMode(false); setError(''); }} className="w-full text-center text-sm text-slate-500 hover:text-white transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                  Back to Sign In
                </button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="input-label flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-violet-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@email.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="input-label !mb-0 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-violet-400" />
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(''); }}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
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
                </div>

                {lockedUntil && (
                  <p className="text-xs text-yellow-400 text-center">
                    Account locked for {lockCountdown}s due to too many failed attempts
                  </p>
                )}

                <button type="submit" disabled={loading || !!lockedUntil} className="btn-primary w-full">
                  {loading ? 'Signing in...' : lockedUntil ? `Locked (${lockCountdown}s)` : 'Sign In'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Don't have an account?{' '}
                <Link to="/signup" className="text-violet-400 hover:text-violet-300 font-medium">
                  Sign up
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
