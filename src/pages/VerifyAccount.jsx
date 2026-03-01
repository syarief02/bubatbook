import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import {
  FileCheck, Shield, Upload, FileImage, Loader2,
  CheckCircle, AlertCircle, Phone, CreditCard, Clock
} from 'lucide-react';

export default function VerifyAccount() {
  const { user, profile, isVerified, refreshProfile } = useAuth();
  const toast = useToast();

  const [icNumber, setIcNumber] = useState(profile?.ic_number || '');
  const [licenceNumber, setLicenceNumber] = useState(profile?.licence_number || '');
  const [licenceExpiry, setLicenceExpiry] = useState(profile?.licence_expiry || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [icFile, setIcFile] = useState(null);
  const [licenceFile, setLicenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const hasSubmittedDocs = profile?.ic_number && profile?.licence_number && !isVerified;

  function validateFile(file, label) {
    if (!file) return `${label} image is required`;
    if (file.size > MAX_FILE_SIZE) return `${label} file exceeds 5MB limit`;
    if (!ALLOWED_TYPES.includes(file.type)) return `${label}: only JPG, PNG, WebP, or PDF allowed`;
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validate fields
    if (!icNumber.trim()) { setError('IC / Passport number is required.'); return; }
    if (!licenceNumber.trim()) { setError('Driving licence number is required.'); return; }
    if (!licenceExpiry) { setError('Licence expiry date is required.'); return; }
    if (new Date(licenceExpiry) < new Date()) { setError('Your driving licence has expired.'); return; }
    if (!phone.trim()) { setError('Phone number is required.'); return; }
    if (phone.replace(/\D/g, '').length < 9) { setError('Please enter a valid phone number.'); return; }

    // Only require files if not previously uploaded
    if (!profile?.ic_file_path) {
      const icErr = validateFile(icFile, 'IC / Passport');
      if (icErr) { setError(icErr); return; }
    }
    if (!profile?.licence_file_path) {
      const licErr = validateFile(licenceFile, 'Driving Licence');
      if (licErr) { setError(licErr); return; }
    }

    setUploading(true);

    try {
      let icPath = profile?.ic_file_path || null;
      let licencePath = profile?.licence_file_path || null;

      // Upload IC file
      if (icFile) {
        const ext = icFile.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
        const filePath = `profiles/${user.id}/ic_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('customer-documents')
          .upload(filePath, icFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        icPath = filePath;
      }

      // Upload licence file
      if (licenceFile) {
        const ext = licenceFile.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
        const filePath = `profiles/${user.id}/licence_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('customer-documents')
          .upload(filePath, licenceFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        licencePath = filePath;
      }

      // Update profile
      const { error: updateErr } = await supabase
        .from('bubatrent_booking_profiles')
        .update({
          ic_number: icNumber.trim(),
          licence_number: licenceNumber.trim(),
          licence_expiry: licenceExpiry,
          ic_file_path: icPath,
          licence_file_path: licencePath,
          phone: phone.trim(),
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      await refreshProfile();
      setSubmitted(true);
      toast.success('Documents submitted for verification!');
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // Already verified
  if (isVerified) {
    return (
      <div className="page-container max-w-xl mx-auto">
        <div className="glass-card text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Verified</h1>
          <p className="text-sm text-slate-400 mb-6">Your identity has been verified. You can now book cars.</p>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Browse Fleet
          </Link>
        </div>
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
          <p className="text-sm text-slate-400 mb-2">Your documents have been submitted and are being reviewed.</p>
          <p className="text-xs text-slate-500 mb-6">This usually takes less than 24 hours. You'll be able to book once verified.</p>
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
        <p className="text-sm text-slate-400">Submit your ID and driving licence to start booking</p>
      </div>

      {/* Security notice */}
      <div className="glass-card !p-4 flex items-start gap-3 mb-6">
        <Shield className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <p className="text-green-300 font-medium mb-1">Your documents are secure</p>
          <p>Files are stored in private encrypted storage, accessible only by our admin team. All access is logged and documents are handled per our data retention policy.</p>
        </div>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Phone Number */}
          <div>
            <label className="input-label flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-violet-400" />
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              placeholder="+60 12-345 6789"
              maxLength={20}
              disabled={uploading}
            />
          </div>

          {/* IC Section */}
          <div className="border-t border-white/5 pt-5">
            <p className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-violet-400" />
              IC / Passport
            </p>

            <div className="space-y-4">
              <div>
                <label className="input-label">IC / Passport Number *</label>
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
                <label className="input-label">IC / Passport Image *</label>
                <label className="flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors">
                  <FileImage className="w-6 h-6 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-300">{icFile ? icFile.name : 'Click to upload IC / passport photo'}</p>
                    <p className="text-xs text-slate-500">JPG, PNG, WebP or PDF · Max 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setIcFile(e.target.files[0])}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Licence Section */}
          <div className="border-t border-white/5 pt-5">
            <p className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-violet-400" />
              Driving Licence
            </p>

            <div className="space-y-4">
              <div>
                <label className="input-label">Driving Licence Number *</label>
                <input
                  type="text"
                  value={licenceNumber}
                  onChange={(e) => setLicenceNumber(e.target.value)}
                  className="input-field"
                  placeholder="Enter your licence number"
                  maxLength={30}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="input-label">Licence Expiry Date *</label>
                <input
                  type="date"
                  value={licenceExpiry}
                  onChange={(e) => setLicenceExpiry(e.target.value)}
                  className="input-field"
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="input-label">Driving Licence Image *</label>
                <label className="flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors">
                  <FileImage className="w-6 h-6 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-300">{licenceFile ? licenceFile.name : 'Click to upload licence photo'}</p>
                    <p className="text-xs text-slate-500">JPG, PNG, WebP or PDF · Max 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLicenceFile(e.target.files[0])}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <button type="submit" disabled={uploading} className="btn-primary w-full flex items-center justify-center gap-2">
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Submit for Verification
              </>
            )}
          </button>

          <p className="text-xs text-slate-600 text-center">
            Your documents are stored securely and only accessible by our admin team.
          </p>
        </form>
      </div>
    </div>
  );
}
