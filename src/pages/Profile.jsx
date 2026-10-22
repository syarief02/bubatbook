import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useBookings, useMyFleetCredits } from '../hooks/useBookings';
import { useToast } from '../components/Toast';
import BookingStatusBadge from '../components/BookingStatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatMYR } from '../utils/pricing';
import { formatDate } from '../utils/dates';
import { friendlyDbError } from '../utils/dbErrors';
import { bankDetailsError, bankForSave, bankFromProfile, hasBankDetails } from '../utils/banks';
import BankDetailsFields from '../components/BankDetailsFields';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  Wallet,
  Edit3,
  Save,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  CalendarDays,
  FileCheck,
  ExternalLink,
  Landmark,
} from 'lucide-react';

export default function Profile() {
  const { user, profile, isVerified, refreshProfile } = useAuth();
  const { bookings, loading: bookingsLoading } = useBookings(user?.id);
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [addressLine1, setAddressLine1] = useState(profile?.address_line1 || '');
  const [addressLine2, setAddressLine2] = useState(profile?.address_line2 || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [postcode, setPostcode] = useState(profile?.postcode || '');
  // Bank account for deposit refunds; checkout sends customers here (#bank) to add it
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [bank, setBank] = useState(bankFromProfile(profile));
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (location.hash !== '#bank') return;
    if (!hasBankDetails(profile)) setEditingBank(true);
    document.getElementById('bank')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Only when arriving with #bank
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);

  useEffect(() => {
    if (profile) {
      setBank(bankFromProfile(profile));
      setDisplayName(profile.display_name || '');
      setAddressLine1(profile.address_line1 || '');
      setAddressLine2(profile.address_line2 || '');
      setCity(profile.city || '');
      setState(profile.state || '');
      setPostcode(profile.postcode || '');
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('bubatrent_booking_profiles')
        .update({
          display_name: displayName.trim(),
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim(),
          postcode: postcode.trim(),
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBank() {
    const err = bankDetailsError(bank);
    if (err) {
      toast.error(err);
      return;
    }
    setSavingBank(true);
    try {
      const { error } = await supabase
        .from('bubatrent_booking_profiles')
        .update(bankForSave(bank))
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setEditingBank(false);
      toast.success('Bank details saved');
      // Back to the booking that asked for them
      if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) navigate(returnTo);
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setSavingBank(false);
    }
  }

  const licenceExpired = profile?.licence_expiry && new Date(profile.licence_expiry) < new Date();
  const credit = Number(profile?.deposit_credit || 0);
  // Credit is with the rental company that gave it and pays deposits with them
  const { credits: creditByFleet } = useMyFleetCredits(user?.id);

  return (
    <div className="page-container max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Profile Info */}
        <div className="flex-1 space-y-6">
          {/* Basic Info */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Personal Info
              </h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                  >
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  {editing ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="input-field !py-1.5 text-sm"
                      placeholder="Display name"
                    />
                  ) : (
                    <p className="text-white font-medium">{profile?.display_name || 'Unnamed'}</p>
                  )}
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {user?.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5">
                <div>
                  <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  {/* Changing the number re-checks for a counter record to link */}
                  <p className="text-sm text-white">
                    {profile?.phone || '—'}{' '}
                    <Link
                      to={`/complete-profile?change=1&returnTo=${encodeURIComponent('/profile')}`}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      Change
                    </Link>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <CreditCard className="w-3 h-3" /> IC Number
                  </label>
                  <p className="text-sm text-white">{profile?.ic_number || '—'}</p>
                </div>
              </div>

              {/* Address */}
              <div className="pt-3 border-t border-white/5">
                <label className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                  <MapPin className="w-3 h-3" /> Address
                </label>
                {editing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      className="input-field !py-1.5 text-sm"
                      placeholder="Address line 1"
                    />
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      className="input-field !py-1.5 text-sm"
                      placeholder="Address line 2 (optional)"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="input-field !py-1.5 text-sm"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="input-field !py-1.5 text-sm"
                        placeholder="State"
                      />
                      <input
                        type="text"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        className="input-field !py-1.5 text-sm"
                        placeholder="Postcode"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white">
                    {profile?.address_line1 ? (
                      <>
                        {profile.address_line1}
                        {profile.address_line2 ? `, ${profile.address_line2}` : ''}
                        <br />
                        {profile.city}, {profile.state} {profile.postcode}
                      </>
                    ) : (
                      '—'
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bank Account */}
          <div id="bank" className="glass-card scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-4 h-4" /> Bank Account
              </h2>
              {!editingBank ? (
                <button
                  onClick={() => setEditingBank(true)}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> {hasBankDetails(profile) ? 'Edit' : 'Add'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBank}
                    disabled={savingBank}
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                  >
                    <Save className="w-3.5 h-3.5" /> {savingBank ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setBank(bankFromProfile(profile));
                      setEditingBank(false);
                    }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              )}
            </div>

            {editingBank ? (
              <>
                <p className="text-xs text-slate-500 mb-4">
                  Your deposit is refunded to this account. Only our staff can see it.
                  {returnTo && ' After saving, you go back to your booking.'}
                </p>
                <BankDetailsFields value={bank} onChange={setBank} disabled={savingBank} />
              </>
            ) : hasBankDetails(profile) ? (
              <div className="text-sm space-y-1">
                <p className="text-white">{profile.bank_name}</p>
                <p className="text-white font-mono tracking-wide">{profile.bank_account_number}</p>
                <p className="text-slate-400">{profile.bank_account_holder}</p>
                <p className="text-xs text-slate-500 pt-1">
                  Deposits are refunded to this account.
                </p>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-sm text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Not added yet. Add the account your deposit is refunded to: you need it before
                booking.
              </p>
            )}
          </div>

          {/* Verification Status */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Verification
            </h2>
            <div className="flex items-center gap-3 mb-4">
              {isVerified ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-300 text-sm">
                  <CheckCircle className="w-4 h-4" /> Verified
                </div>
              ) : profile?.ic_number && !profile?.is_verified ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-300 text-sm">
                  <Clock className="w-4 h-4" /> Pending Verification
                </div>
              ) : licenceExpired ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" /> Licence Expired
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/10 text-slate-400 text-sm">
                  <Shield className="w-4 h-4" /> Not Verified
                </div>
              )}
            </div>

            {profile?.licence_expiry && (
              <p className="text-xs text-slate-500 mb-3">
                Licence expires:{' '}
                <span className={licenceExpired ? 'text-red-400' : 'text-white'}>
                  {formatDate(profile.licence_expiry)}
                </span>
              </p>
            )}

            <Link
              to="/verify"
              className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              {isVerified ? 'Update Verification Documents' : 'Verify Now'}
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Right: Credit + Bookings */}
        <div className="lg:w-80 shrink-0 space-y-6">
          {/* Credit Balance */}
          <div className="glass-card glow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Deposit Credit</p>
                <p className="text-2xl font-bold text-white">{formatMYR(credit)}</p>
              </div>
            </div>
            {creditByFleet.length > 1 && (
              <ul className="text-xs text-slate-400 mb-2 space-y-0.5">
                {creditByFleet.map((c) => (
                  <li key={c.fleet_group_id} className="flex justify-between">
                    <span>{c.fleet_name}</span>
                    <span>{formatMYR(c.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500">
              Applied automatically to your next booking deposit with the same rental company
              {creditByFleet.length === 1 ? ` (${creditByFleet[0].fleet_name})` : ''}.
            </p>
          </div>

          {/* Recent Bookings */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Recent Bookings
              </h2>
              <Link to="/my-bookings" className="text-xs text-violet-400 hover:text-violet-300">
                View all
              </Link>
            </div>
            {bookingsLoading ? (
              <LoadingSpinner />
            ) : bookings.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No bookings yet</p>
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 5).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {b.bubatrent_booking_cars?.name || 'Car'}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {formatDate(b.pickup_date)}
                      </p>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
