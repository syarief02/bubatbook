import { useState } from 'react';
import { Upload, FileImage, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DocumentUpload({ bookingId, onUploadComplete }) {
  const [licenceNumber, setLicenceNumber] = useState('');
  const [licenceExpiry, setLicenceExpiry] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [licenceFile, setLicenceFile] = useState(null);
  const [icFile, setIcFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  function validateFile(file) {
    if (!file) return null;
    if (file.size > MAX_FILE_SIZE) return `${file.name} exceeds 5MB limit`;
    if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG, WebP, or PDF allowed`;
    return null;
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!licenceNumber || !licenceExpiry) {
      setError('Licence number and expiry date are required.');
      return;
    }
    if (licenceExpiry && new Date(licenceExpiry) < new Date()) {
      setError('Licence has expired. Please provide a valid licence.');
      return;
    }
    const licErr = validateFile(licenceFile);
    if (licErr) { setError(licErr); return; }
    const icErr = validateFile(icFile);
    if (icErr) { setError(icErr); return; }

    setUploading(true);
    setError('');

    try {
      let licencePath = null;
      let icPath = null;

      if (licenceFile) {
        const ext = licenceFile.name.split('.').pop();
        const filePath = `${bookingId}/licence_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('customer-documents')
          .upload(filePath, licenceFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        licencePath = filePath;
      }

      if (icFile) {
        const ext = icFile.name.split('.').pop();
        const filePath = `${bookingId}/ic_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('customer-documents')
          .upload(filePath, icFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        icPath = filePath;
      }

      const { error: insertErr } = await supabase
        .from('bubatrent_booking_customer_documents')
        .insert({
          booking_id: bookingId,
          licence_number: licenceNumber,
          licence_expiry: licenceExpiry,
          ic_number: icNumber || null,
          licence_file_path: licencePath,
          ic_file_path: icPath,
        });

      if (insertErr) throw insertErr;
      setSuccess(true);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (success) {
    return (
      <div className="glass-card text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Documents Uploaded</h3>
        <p className="text-sm text-slate-400">Your documents have been submitted for verification.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpload} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

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
        <label className="input-label">Driving Licence Image</label>
        <label className="flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors">
          <FileImage className="w-6 h-6 text-slate-500" />
          <div>
            <p className="text-sm text-slate-300">{licenceFile ? licenceFile.name : 'Click to upload licence photo'}</p>
            <p className="text-xs text-slate-500">JPG, PNG or PDF</p>
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

      <div className="border-t border-white/5 pt-5">
        <p className="text-xs text-slate-500 mb-4">IC / Passport (Optional)</p>

        <div className="mb-4">
          <label className="input-label">IC / Passport Number</label>
          <input
            type="text"
            value={icNumber}
            onChange={(e) => setIcNumber(e.target.value)}
            className="input-field"
            placeholder="Optional"
            maxLength={30}
            disabled={uploading}
          />
        </div>

        <div>
          <label className="input-label">IC / Passport Image</label>
          <label className="flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors">
            <FileImage className="w-6 h-6 text-slate-500" />
            <div>
              <p className="text-sm text-slate-300">{icFile ? icFile.name : 'Click to upload IC/passport photo'}</p>
              <p className="text-xs text-slate-500">JPG, PNG or PDF</p>
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

      <button type="submit" disabled={uploading} className="btn-primary w-full flex items-center justify-center gap-2">
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            Submit Documents
          </>
        )}
      </button>

      <p className="text-xs text-slate-600 text-center">
        Your documents are stored securely and only accessible by our admin team.
      </p>
    </form>
  );
}
