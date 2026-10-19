import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { SignedLink, SignedImage } from './SignedFile';
import { formatDate, formatDateTime, getTodayString } from '../utils/dates';
import { friendlyDbError } from '../utils/dbErrors';
import { RefreshCw, CheckCircle, XCircle, Loader2, FileText, ArrowRight } from 'lucide-react';

const addressText = (a) =>
  [a.address_line1, a.address_line2, a.city, a.postcode, a.state].filter(Boolean).join(', ');

// A new photo the customer sent (opens full size)
function NewDocument({ label, path }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2">
      <p className="text-[10px] text-slate-500 mb-1">{label} (new)</p>
      <SignedLink path={path} className="block">
        {path.toLowerCase().endsWith('.pdf') ? (
          <div className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-lg bg-white/5 text-xs text-slate-300 hover:bg-white/10">
            <FileText className="w-6 h-6" /> View PDF
          </div>
        ) : (
          <SignedImage
            path={path}
            alt={label}
            className="w-full h-20 object-cover rounded-lg hover:opacity-80 transition-opacity"
          />
        )}
      </SignedLink>
    </div>
  );
}

function Change({ label, from, to, warn }) {
  return (
    <p className="text-xs text-slate-400 flex flex-wrap items-center gap-1">
      <span className="text-slate-500">{label}:</span>
      <span className="line-through text-slate-600">{from || '—'}</span>
      <ArrowRight className="w-3 h-3 text-slate-600" />
      <span className={warn ? 'text-red-400' : 'text-white'}>{to || '—'}</span>
    </p>
  );
}

// A licence renewal or document update the customer sent from Verify Account,
// waiting for an admin. Approving puts the new details on the profile (and
// keeps the customer verified); rejecting sends the reason back to them.
export default function VerificationUpdateReview({ customer, onReviewed }) {
  const toast = useToast();
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('bubatrent_booking_verification_updates')
      .select('*')
      .eq('user_id', customer.id)
      .eq('status', 'pending')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setUpdate(data || null);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  if (!update) return null;

  async function review(approve) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('bubatrent_admin_review_verification_update', {
        p_update_id: update.id,
        p_approve: approve,
        p_reason: approve ? null : reason,
      });
      if (error) throw error;
      toast.success(
        approve
          ? 'Update approved: the new details are on the customer'
          : 'Update rejected: the customer sees your reason'
      );
      setUpdate(null);
      onReviewed?.();
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setBusy(false);
    }
  }

  const expired = update.licence_expiry && update.licence_expiry < getTodayString();
  const newLicence = update.licence_file_path !== customer.licence_file_path;
  const newIc = update.ic_file_path !== customer.ic_file_path;
  const addressChanged = update.address_line1 && addressText(update) !== addressText(customer);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-amber-300 flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4" /> Licence renewal to review
        </p>
        <p className="text-[11px] text-slate-500">
          Sent {formatDateTime(update.created_at)}. Nothing changes until you approve.
        </p>
      </div>

      <div className="space-y-1">
        <Change
          label="Licence expiry"
          from={customer.licence_expiry ? formatDate(customer.licence_expiry) : null}
          to={formatDate(update.licence_expiry)}
          warn={expired}
        />
        {update.ic_number !== customer.ic_number && (
          <Change label="IC number" from={customer.ic_number} to={update.ic_number} />
        )}
        {addressChanged && (
          <Change label="Address" from={addressText(customer)} to={addressText(update)} />
        )}
        {expired && (
          <p className="text-[11px] text-red-400">
            This licence has already expired: reject it and ask for a valid one.
          </p>
        )}
      </div>

      {(newLicence || newIc) && (
        <div className="grid grid-cols-2 gap-2">
          {newLicence && update.licence_file_path && (
            <NewDocument label="Driving Licence" path={update.licence_file_path} />
          )}
          {newIc && update.ic_file_path && <NewDocument label="IC" path={update.ic_file_path} />}
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        Check the new photo matches the customer and the expiry date.
      </p>

      {rejecting ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field !py-1.5 text-xs"
            rows={2}
            maxLength={500}
            placeholder="Reason, shown to the customer (e.g. the licence photo is blurry)"
          />
          <div className="flex gap-2">
            <button
              onClick={() => review(false)}
              disabled={busy || !reason.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              Reject update
            </button>
            <button
              onClick={() => setRejecting(false)}
              disabled={busy}
              className="px-3 py-2 rounded-xl text-xs text-slate-400 bg-white/5 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => review(true)}
            disabled={busy || expired}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Approve update
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}
