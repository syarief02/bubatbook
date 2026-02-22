import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, AlertCircle, Car } from 'lucide-react';

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
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
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-slate-400">Sign in to your BubatRent account</p>
        </div>

        <div className="glass-card">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

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
              <label className="input-label flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-violet-400" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
