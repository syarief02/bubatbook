import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { Modal } from './ReturnCharges';
import { useToast } from './Toast';
import { supabase } from '../lib/supabase';
import { uploadFileRobust } from '../lib/uploadHelper';
import { getTodayString } from '../utils/dates';
import { friendlyDbError } from '../utils/dbErrors';
import { formatMYR } from '../utils/pricing';

// A deposit the customer pays later (usually at pick-up): the admin records
// it here, cash or transfer, with its own receipt
// (bubatrent_admin_receive_deposit).

const BUCKET = 'customer-documents';

export function ReceiveDepositDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const [method, setMethod] = useState('cash');
  const [paidOn, setPaidOn] = useState(getTodayString());
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    let path = null;
    try {
      if (receipt) {
        path = `receipts/${booking.id}/deposit_${Date.now()}.${receipt.name.split('.').pop()}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, path, receipt, toast);
        if (upErr) throw upErr;
      }
      const { error } = await supabase.rpc('bubatrent_admin_receive_deposit', {
        p_booking_id: booking.id,
        p_method: method,
        p_receipt_path: path,
        p_paid_on: paidOn || null,
      });
      if (error) throw error;
      toast.success(`${formatMYR(booking.deposit_amount)} deposit recorded as received.`);
      onDone();
    } catch (err) {
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      toast.error(friendlyDbError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Deposit received" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          {`${formatMYR(booking.deposit_amount)} deposit from ${booking.customer_name || 'the customer'}.`}{' '}
          It is held during the rental and refunded (or kept as credit) after the return.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['cash', 'Cash'],
            ['bank_transfer', 'Transfer'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMethod(k)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-medium ${
                method === k
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                  : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Paid on</p>
            <input
              type="date"
              value={paidOn}
              max={getTodayString()}
              onChange={(e) => setPaidOn(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Deposit receipt (optional)</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
              className="input-field !py-1.5 text-xs"
            />
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary w-full !py-3.5 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          {saving ? 'Saving...' : `Record ${formatMYR(booking.deposit_amount)} deposit`}
        </button>
      </div>
    </Modal>
  );
}
