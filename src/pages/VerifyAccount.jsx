import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { uploadFileRobust } from '../lib/uploadHelper';
import { useToast } from '../components/Toast';
import { normalizePhone } from '../utils/phoneUtils';
import { friendlyDbError } from '../utils/dbErrors';
import { formatDate, formatDateTime } from '../utils/dates';
import { bankDetailsError, bankForSave, bankFromProfile, hasBankDetails } from '../utils/banks';
import BankDetailsFields from '../components/BankDetailsFields';
import {
  FileCheck,
  Shield,
  Upload,
  FileImage,
  Loader2,
  CheckCircle,
  AlertCircle,
  Phone,
  CreditCard,
  Clock,
  MapPin,
  Landmark,
} from 'lucide-react';

export default function VerifyAccount() {
  const { user, profile, isVerified, refreshProfile } = useAuth();
  const toast = useToast();

  const licenceExpired =
    profile?.is_verified &&
    profile?.licence_expiry &&
    new Date(profile.licence_expiry) < new Date();
  const hasSubmittedDocs = profile?.ic_number && profile?.ic_file_path && !profile?.is_verified;
  // A verified customer renewing their licence (or updating their IC) sends the
  // new details for an admin to review; the latest one says where that stands.
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const updating = Boolean(profile?.is_verified);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('bubatrent_booking_verification_updates')
      .select('status, rejection_reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatestUpdate(data || null));
  }, [user?.id]);

  const [icNumber, setIcNumber] = useState(profile?.ic_number || '');
  const [licenceExpiry, setLicenceExpiry] = useState(profile?.licence_expiry || '');
  // The number set on /complete-profile; changed from the Profile page
  const phone = profile?.phone || '';
  const [addressLine1, setAddressLine1] = useState(profile?.address_line1 || '');
  const [addressLine2, setAddressLine2] = useState(profile?.address_line2 || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [postcode, setPostcode] = useState(profile?.postcode || '');
  // Where deposits are refunded; saved on the profile (the customer can change it there)
  const [bank, setBank] = useState(bankFromProfile(profile));
  const [icFile, setIcFile] = useState(null);
  const [licenceFile, setLicenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

  function validateFile(file, label) {
    if (!file) return `${label} image is required`;
    if (file.size > MAX_FILE_SIZE) return `${label} file exceeds 15MB limit`;
    const ext = file.name?.split('.').pop()?.toLowerCase();
    const isAllowedExt = ext && ALLOWED_EXTS.includes(ext);
    const isAllowedType =
      file.type?.startsWith('image/') || file.type === 'application/pdf' || file.type === ''; // Android gallery empty mime fallback
    if (!isAllowedExt && !isAllowedType) {
      return `${label}: only JPG, PNG, WebP, or PDF allowed`;
    }
    return null;
  }

  async function uploadFile(file, folder) {
    const ext =
      file.name
        .split('.')
        .pop()
        .replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const filePath = `profiles/${user.id}/${folder}_${Date.now()}.${ext}`;
    const { error: uploadErr } = await uploadFileRobust(
      'customer-documents',
      filePath,
      file,
      toast
    );
    if (uploadErr) throw uploadErr;
    return filePath;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!icNumber.trim()) {
      setError('IC / MyKad number is required.');
      return;
    }
    if (!licenceExpiry) {
      setError('Driving licence expiry date is required.');
      return;
    }
    if (new Date(licenceExpiry) < new Date()) {
      setError('Your driving licence has expired. Please enter a valid expiry date.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!addressLine1.trim()) {
      setError('Address line 1 is required.');
      return;
    }
    if (!city.trim()) {
      setError('City is required.');
      return;
    }
    if (!state.trim()) {
      setError('State is required.');
      return;
    }
    if (!postcode.trim()) {
      setError('Postcode is required.');
      return;
    }
    const bankErr = bankDetailsError(bank);
    if (bankErr) {
      setError(bankErr);
      return;
    }

    // For first-time verification, files are required
    const isUpdate = profile?.is_verified || hasSubmittedDocs;
    if (updating) {
      // A new expiry date needs the new licence; a new IC number a new IC photo
      const newExpiry = licenceExpiry !== (profile.licence_expiry || '');
      const newIc = icNumber.trim() !== (profile.ic_number || '');
      if (newExpiry && !licenceFile) {
        setError('Please upload a photo of your new driving licence.');
        return;
      }
      if (newIc && !icFile) {
        setError('Please upload a photo of your IC for the new IC number.');
        return;
      }
      if (!newExpiry && !newIc && !icFile && !licenceFile) {
        setError('Nothing to review: enter your new licence expiry date and upload its photo.');
        return;
      }
    }
    if (!isUpdate) {
      const icErr = validateFile(icFile, 'IC / MyKad');
      if (icErr) {
        setError(icErr);
        return;
      }
      const licErr = validateFile(licenceFile, 'Driving Licence');
      if (licErr) {
        setError(licErr);
        return;
      }
    }

    setUploading(true);
    try {
      let icPath = profile?.ic_file_path || null;
      let licencePath = profile?.licence_file_path || null;

      if (icFile) {
        setUploadStatus('Uploading IC / MyKad (1/2)...');
        icPath = await uploadFile(icFile, 'ic');
      }
      if (licenceFile) {
        setUploadStatus('Uploading Driving Licence (2/2)...');
        licencePath = await uploadFile(licenceFile, 'licence');
      }

      setUploadStatus('Saving profile...');
      if (isUpdate) {
        // Submit as pending verification update (old stays valid)
        const { error: insertErr } = await supabase
          .from('bubatrent_booking_verification_updates')
          .insert({
            user_id: user.id,
            ic_number: icNumber.trim(),
            licence_expiry: licenceExpiry,
            ic_file_path: icPath,
            licence_file_path: licencePath,
            phone: normalizePhone(phone),
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim(),
            city: city.trim(),
            state: state.trim(),
            postcode: postcode.trim(),
          });
        if (insertErr) throw insertErr;
        setLatestUpdate({ status: 'pending', created_at: new Date().toISOString() });
        // Bank details aren't part of the identity check: saved straight away
        const { error: bankErr } = await supabase
          .from('bubatrent_booking_profiles')
          .update(bankForSave(bank))
          .eq('id', user.id);
        if (bankErr) throw bankErr;
      } else {
        // First-time: update or insert profile directly (still needs admin approval)
        const { error: updateErr } = await supabase.from('bubatrent_booking_profiles').upsert(
          {
            id: user.id,
            email: user.email,
            display_name:
              profile?.display_name ||
              user.user_metadata?.display_name ||
              user.email?.split('@')[0],
            ic_number: icNumber.trim(),
            licence_expiry: licenceExpiry,
            ic_file_path: icPath,
            licence_file_path: licencePath,
            phone: normalizePhone(phone),
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim(),
            city: city.trim(),
            state: state.trim(),
            postcode: postcode.trim(),
            ...bankForSave(bank),
          },
          { onConflict: 'id' }
        );
        if (updateErr) throw updateErr;
      }

      await refreshProfile();
      setSubmitted(true);
      // The form was long; show the "Verification Pending" message from the top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(
        isUpdate ? 'Verification update submitted!' : 'Documents submitted for verification!'
      );
    } catch (err) {
      setError(friendlyDbError(err));
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  }

  // A renewal sent and waiting for an admin
  if (updating && latestUpdate?.status === 'pending') {
    return (
      <div className="page-container max-w-xl mx-auto">
        <div className="glass-card text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Update Under Review</h1>
          <p className="text-sm text-slate-400 mb-2">
            We received your new details on {formatDateTime(latestUpdate.created_at)} and are
            checking them. This usually takes less than 24 hours.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            {licenceExpired
              ? "You can book again once it's approved."
              : 'Your current verification stays valid meanwhile.'}
          </p>
          <Link to="/" className="btn-secondary inline-flex items-center gap-2">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Verified customer renewing before the licence expires
  if (isVerified && !licenceExpired && showUpdate) {
    return (
      <div className="page-container max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Update Your Licence or IC</h1>
          <p className="text-sm text-slate-400">
            Change the expiry date and upload the new licence. We check it, then it replaces the old
            one.
          </p>
        </div>
        {renderForm()}
      </div>
    );
  }

  // Already verified (and licence not expired)
  if (isVerified && !licenceExpired) {
    return (
      <div className="page-container max-w-xl mx-auto">
        <div className="glass-card text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Verified</h1>
          <p className="text-sm text-slate-400 mb-2">
            Your identity has been verified. You can now book cars.
          </p>
          {latestUpdate?.status === 'rejected' && (
            <p className="text-xs text-red-300 mb-2">
              Your last update wasn&apos;t accepted
              {latestUpdate.rejection_reason ? `: ${latestUpdate.rejection_reason}` : '.'}
            </p>
          )}
          <p className="text-xs text-slate-500 mb-6">
            {profile?.licence_expiry &&
              `Licence valid until ${formatDate(profile.licence_expiry)}. `}
            <button
              onClick={() => setShowUpdate(true)}
              className="text-violet-400 hover:text-violet-300 underline"
            >
              Renew licence or update IC
            </button>
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="btn-primary inline-flex items-center gap-2">
              Browse Fleet
            </Link>
            <Link to="/profile" className="btn-secondary inline-flex items-center gap-2">
              View Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Licence expired — must update
  if (licenceExpired) {
    return (
      <div className="page-container max-w-xl mx-auto">
        <div className="glass-card text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Licence Expired</h1>
          <p className="text-sm text-slate-400 mb-4">
            Your driving licence has expired. Please update your licence to continue booking.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Upload a new licence with a valid expiry date below.
          </p>
        </div>
        {renderForm()}
      </div>
    );
  }

  // Pending verification (docs submitted, waiting for admin)
  if (hasSubmittedDocs || submitted) {
    return (
      <div className="page-container max-w-xl mx-auto">
        <div className="glass-card text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verification Pending</h1>
          <p className="text-sm text-slate-400 mb-2">
            Your documents have been submitted and are being reviewed.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            This usually takes less than 24 hours. You&apos;ll be able to book once verified.
          </p>
          {!hasBankDetails(profile) && (
            <p className="text-xs text-amber-300 mb-6">
              Please also add your bank details, for deposit refunds:{' '}
              <Link to="/profile#bank" className="text-violet-400 hover:text-violet-300 underline">
                Add bank details
              </Link>
            </p>
          )}
          <Link to="/" className="btn-secondary inline-flex items-center gap-2">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
          <FileCheck className="w-7 h-7 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Verify Your Account</h1>
        <p className="text-sm text-slate-400">
          Submit your IC, driving licence, address and bank details to start booking
        </p>
      </div>
      {renderForm()}
    </div>
  );

  function renderForm() {
    return (
      <>
        <div className="glass-card !p-4 flex items-start gap-3 mb-6">
          <Shield className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="text-green-300 font-medium mb-1">Your documents are secure</p>
            <p>Files are stored in private encrypted storage, accessible only by our admin team.</p>
          </div>
        </div>

        <div className="glass-card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {updating && latestUpdate?.status === 'rejected' && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                Your last update wasn&apos;t accepted
                {latestUpdate.rejection_reason ? `: ${latestUpdate.rejection_reason}` : '.'} Please
                send it again.
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="input-label flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-violet-400" />
                Phone Number *
              </label>
              <input type="tel" value={phone} className="input-field opacity-70" readOnly />
              <p className="text-xs text-slate-500 mt-1">You can change it from your profile.</p>
            </div>

            {/* IC Section */}
            <div className="border-t border-white/5 pt-5">
              <p className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-violet-400" />
                IC / MyKad
              </p>
              <div className="space-y-4">
                <div>
                  <label className="input-label">IC Number (MyKad) *</label>
                  <input
                    type="text"
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 990101-14-1234"
                    maxLength={30}
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="input-label">Driving Licence Expiry Date *</label>
                  <input
                    type="date"
                    value={licenceExpiry}
                    onChange={(e) => setLicenceExpiry(e.target.value)}
                    className="input-field"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="input-label">
                    {updating
                      ? 'New IC / MyKad Photo (only if your IC changed)'
                      : 'IC / MyKad Image *'}
                  </label>
                  <label className="relative flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors overflow-hidden">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setIcFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={uploading}
                    />
                    <FileImage className="w-6 h-6 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-300">
                        {icFile ? icFile.name : 'Click or tap to upload IC photo'}
                      </p>
                      <p className="text-xs text-slate-500">
                        JPG, PNG, WebP or PDF · Up to 12MB (auto-compressed)
                      </p>
                    </div>
                  </label>
                </div>
                <div>
                  <label className="input-label">
                    {updating ? 'New Driving Licence Photo *' : 'Driving Licence Image *'}
                  </label>
                  <label className="relative flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors overflow-hidden">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setLicenceFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={uploading}
                    />
                    <FileImage className="w-6 h-6 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-300">
                        {licenceFile ? licenceFile.name : 'Click or tap to upload licence photo'}
                      </p>
                      <p className="text-xs text-slate-500">
                        JPG, PNG, WebP or PDF · Up to 12MB (auto-compressed)
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="border-t border-white/5 pt-5">
              <p className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-400" />
                Address
              </p>
              <div className="space-y-4">
                <div>
                  <label className="input-label">Address Line 1 *</label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="input-field"
                    placeholder="Street address"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="input-label">Address Line 2</label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="input-field"
                    placeholder="Apartment, unit, etc. (optional)"
                    disabled={uploading}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">City *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input-field"
                      placeholder="City"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <label className="input-label">State *</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="input-field"
                      disabled={uploading}
                    >
                      <option value="">Select state</option>
                      {[
                        'Johor',
                        'Kedah',
                        'Kelantan',
                        'Melaka',
                        'Negeri Sembilan',
                        'Pahang',
                        'Perak',
                        'Perlis',
                        'Pulau Pinang',
                        'Sabah',
                        'Sarawak',
                        'Selangor',
                        'Terengganu',
                        'W.P. Kuala Lumpur',
                        'W.P. Labuan',
                        'W.P. Putrajaya',
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="w-1/2">
                  <label className="input-label">Postcode *</label>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 50000"
                    maxLength={10}
                    disabled={uploading}
                  />
                </div>
              </div>
            </div>

            {/* Bank Section */}
            <div className="border-t border-white/5 pt-5">
              <p className="text-sm font-medium text-white mb-1 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-violet-400" />
                Bank Account
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Your deposit is refunded to this account. Only our staff can see it.
              </p>
              <BankDetailsFields value={bank} onChange={setBank} disabled={uploading} />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{uploadStatus || 'Uploading Documents...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />{' '}
                  {updating ? 'Send for Review' : 'Submit for Verification'}
                </>
              )}
            </button>
          </form>
        </div>
      </>
    );
  }
}
