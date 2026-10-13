import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Smartphone, AlertCircle, CheckCircle, Users, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { normalizePhone } from '../utils/phoneUtils';
import { formatMYR } from '../utils/pricing';
import { safeReturnTo } from '../utils/returnTo';

export default function CompleteProfile() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const changing = searchParams.get('change') === '1';
  // Decided once: saving the number updates `profile`, and later steps must still show.
  const [alreadyDone] = useState(() => !!profile?.phone && !changing);

  const [step, setStep] = useState('phone'); // 'phone' | 'ic'
  const [phone, setPhone] = useState(profile?.phone || '');
  const [icNumber, setIcNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Prefill once the profile arrives (e.g. the number given at email sign-up)
  useEffect(() => {
    if (profile?.phone) setPhone((current) => current || profile.phone);
  }, [profile?.phone]);

  if (alreadyDone) return <Navigate to={returnTo} replace />;

  function finish() {
    navigate(returnTo, { replace: true });
  }

  async function saveMobile(e) {
    e.preventDefault();
    setError('');
    const normalized = normalizePhone(phone);
    if (!/^\+\d{9,15}$/.test(normalized)) {
      setError('Please enter a valid mobile number, e.g. 012-345 6789.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: saveErr } = await supabase.rpc('bubatrent_save_mobile', {
        p_phone: normalized,
      });
      if (saveErr) throw saveErr;
      await refreshProfile();
      if (data?.can_link) {
        setStep('ic');
        return;
      }
      toast.success('Mobile number saved');
      finish();
    } catch (err) {
      setError(err.message || 'Could not save your number. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function linkWithIc(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data, error: linkErr } = await supabase.rpc('bubatrent_link_walk_in_by_ic', {
        p_ic_number: icNumber,
      });
      if (linkErr) throw linkErr;
      if (data?.status === 'no_match') {
        setError(
          data.attempts_left > 0
            ? `That IC number doesn't match our record. ${data.attempts_left} attempt${data.attempts_left > 1 ? 's' : ''} left today.`
            : "That IC number doesn't match our record."
        );
        if (data.attempts_left > 0) return;
        setResult({ status: 'locked' });
        return;
      }
      if (data?.status === 'linked') await refreshProfile();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Could not link your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const linked = result.status === 'linked';
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="glass-card text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${linked ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}
            >
              {linked ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <Users className="w-8 h-8 text-yellow-400" />
              )}
            </div>
            {linked ? (
              <>
                <h2 className="text-xl font-semibold text-white mb-2">Welcome back!</h2>
                <p className="text-sm text-slate-400 mb-4">
                  We found the account our team set up for you and linked it to this login.
                </p>
                <ul className="text-sm text-slate-300 space-y-1 mb-6">
                  {result.verified && <li>Your identity is already verified</li>}
                  {result.bookings > 0 && (
                    <li>
                      {result.bookings} previous booking{result.bookings > 1 ? 's' : ''}
                    </li>
                  )}
                  {Number(result.credit) > 0 && <li>{formatMYR(result.credit)} credit</li>}
                </ul>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-white mb-2">
                  We&apos;ll link it for you
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  We couldn&apos;t link your earlier bookings automatically. Tap the WhatsApp button
                  and our team will sort it out. You can keep using your account meanwhile.
                </p>
              </>
            )}
            <button onClick={finish} className="btn-primary w-full">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            {step === 'ic' ? (
              <CreditCard className="w-7 h-7 text-white" />
            ) : (
              <Smartphone className="w-7 h-7 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {step === 'ic'
              ? 'Have you rented from us before?'
              : changing
                ? 'Change your mobile number'
                : 'Add your mobile number'}
          </h1>
          <p className="text-sm text-slate-400">
            {step === 'ic'
              ? 'We have a customer record from our counter with this number. Confirm your IC number to bring over your bookings and verified status.'
              : 'We need it to contact you about your bookings.'}
          </p>
        </div>

        <div className="glass-card">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={saveMobile} className="space-y-5">
              <div>
                <label className="input-label flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-violet-400" />
                  Mobile number
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="012-345 6789"
                  maxLength={20}
                  disabled={busy}
                  required
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Saving...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={linkWithIc} className="space-y-5">
              <div>
                <label className="input-label flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-violet-400" />
                  IC / MyKad number
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={icNumber}
                  onChange={(e) => setIcNumber(e.target.value)}
                  className="input-field"
                  placeholder="900101-14-5555"
                  maxLength={20}
                  disabled={busy}
                  required
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Checking...' : 'Link my account'}
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="w-full text-center text-sm text-slate-500 hover:text-white transition-colors"
              >
                Skip for now
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Signed in as {user?.email}.{' '}
          <button
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
            className="text-violet-400 hover:text-violet-300"
          >
            Use a different account
          </button>
        </p>
      </div>
    </div>
  );
}
