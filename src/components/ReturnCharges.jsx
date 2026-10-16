import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileImage, Wrench, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileRobust } from '../lib/uploadHelper';
import { useToast } from './Toast';
import ChargesEditor from './ChargesEditor';
import { chargeLabel, chargesForSubmit, chargesTotal } from '../utils/charges';
import { friendlyDbError } from '../utils/dbErrors';
import { formatDate, formatDateTime, getTodayString } from '../utils/dates';
import { formatMYR } from '../utils/pricing';

// Returning a car with charges, settling a held deposit, and what the
// customer owes. The money moves happen in the database functions
// bubatrent_admin_return_booking / _settle_deposit / _add_booking_charges /
// _remove_booking_charge / _record_charge_payment.

/** The deposit still held for the booking (what charges can come out of). */
function depositAvailable(booking) {
  return booking.deposit_status === 'verified' && !booking.deposit_credited_at
    ? Number(booking.deposit_amount || 0)
    : 0;
}

// Rendered on document.body: inside a glass-card (backdrop-filter) a fixed
// overlay is clipped to the card and drawn under the cards after it.
export function Modal({ title, onClose, children }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Summary({ deposit, total, owedOnly = false }) {
  const fromDeposit = Math.min(total, deposit);
  const owed = Math.max(total - deposit, 0);
  if (owedOnly) {
    return (
      <div className="bg-white/[0.03] rounded-xl p-3 text-sm flex justify-between">
        <span className="text-slate-400">The customer will owe</span>
        <span className="text-red-400 font-semibold">{formatMYR(total)}</span>
      </div>
    );
  }
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-slate-400">Deposit held</span>
        <span className="text-white">{formatMYR(deposit)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-400">Charges</span>
        <span className="text-white">{formatMYR(total)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-400">Taken from the deposit</span>
        <span className="text-white">{formatMYR(fromDeposit)}</span>
      </div>
      <div className="flex justify-between border-t border-white/5 pt-1">
        <span className="text-slate-400">Back to the customer&apos;s credit</span>
        <span className="text-green-400 font-semibold">{formatMYR(deposit - fromDeposit)}</span>
      </div>
      {owed > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-400">Customer still owes</span>
          <span className="text-red-400 font-semibold">{formatMYR(owed)}</span>
        </div>
      )}
      {deposit === 0 && (
        <p className="text-xs text-amber-400 pt-1">
          This booking has no verified deposit left, so any charges are owed by the customer.
        </p>
      )}
    </div>
  );
}

function resultMessage(data, prefix) {
  const parts = [prefix];
  if (Number(data?.credited) > 0)
    parts.push(`${formatMYR(data.credited)} of the deposit went to the customer's credit.`);
  if (Number(data?.from_deposit) > 0)
    parts.push(`${formatMYR(data.from_deposit)} taken for charges.`);
  if (Number(data?.owed) > 0) parts.push(`Customer owes ${formatMYR(data.owed)}.`);
  return parts.join(' ');
}

/** Mark Returned: charges come off the deposit, or the deposit is held. */
export function ReturnCarDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const [returnDate, setReturnDate] = useState(getTodayString());
  const [hold, setHold] = useState(false);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const deposit = depositAvailable(booking);

  async function submit() {
    let charges;
    try {
      charges = hold ? [] : chargesForSubmit(rows);
    } catch (err) {
      toast.error(err.message);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc('bubatrent_admin_return_booking', {
      p_booking_id: booking.id,
      p_charges: charges,
      p_hold_deposit: hold,
      p_return_date: returnDate,
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    toast.success(
      hold
        ? 'Car returned. The deposit is on hold until you settle it.'
        : resultMessage(data, 'Car returned.')
    );
    onDone();
  }

  return (
    <Modal title="Return car" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="input-label">Returned on</label>
          <input
            type="date"
            value={returnDate}
            min={booking.pickup_date}
            onChange={(e) => setReturnDate(e.target.value)}
            className="input-field !py-1.5 text-sm w-48"
          />
          <p className="text-xs text-slate-500 mt-1">
            Booked return: {formatDate(booking.return_date)}
          </p>
          {returnDate < booking.return_date && (
            <p className="text-xs text-amber-300 mt-1">
              Earlier than booked. To give back unused days (less the penalty if it was the
              customer&apos;s choice), use End early under Change Rental, before or after this.
            </p>
          )}
        </div>

        <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hold}
            onChange={(e) => setHold(e.target.checked)}
            className="mt-1"
          />
          <span>
            Hold the deposit until the damage cost is known
            <span className="block text-xs text-slate-500">
              Nothing goes to the customer&apos;s credit yet. Settle it from this booking once you
              have the repair quote.
            </span>
          </span>
        </label>

        {!hold && (
          <div>
            <p className="input-label">Charges (late return, cleaning, fuel, damage)</p>
            <p className="text-xs text-slate-500 mb-2">
              Enter each amount. Leave empty if the car came back on time and in good condition.
            </p>
            <ChargesEditor rows={rows} onChange={setRows} />
          </div>
        )}

        {hold ? (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            The {formatMYR(deposit)} deposit stays on hold.
          </p>
        ) : (
          <Summary deposit={deposit} total={chargesTotal(rows)} />
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Mark Returned'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ChargesDialog({ title, intro, booking, rpc, deposit, confirmLabel, onClose, onDone }) {
  const toast = useToast();
  const [rows, setRows] = useState(
    rpc === 'bubatrent_admin_add_booking_charges'
      ? [{ kind: 'damage', amount: '', description: '' }]
      : []
  );
  const [saving, setSaving] = useState(false);

  async function submit() {
    let charges;
    try {
      charges = chargesForSubmit(rows);
    } catch (err) {
      toast.error(err.message);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc(rpc, {
      p_booking_id: booking.id,
      p_charges: charges,
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    toast.success(resultMessage(data, 'Saved.'));
    onDone();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">{intro}</p>
        <ChargesEditor rows={rows} onChange={setRows} />
        <Summary
          deposit={deposit}
          total={chargesTotal(rows)}
          owedOnly={rpc === 'bubatrent_admin_add_booking_charges'}
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Charges on a returned booking: held deposit, the list, what is owed. */
export function ChargesCard({ booking, charges, payments, onChanged }) {
  const toast = useToast();
  const [dialog, setDialog] = useState(null); // 'settle' | 'add'
  const [removing, setRemoving] = useState(null); // charge id
  const [removeReason, setRemoveReason] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payFile, setPayFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const owed = Number(booking.amount_owed || 0);
  const chargePaid = payments.some((p) => p.payment_type === 'charge' && p.status === 'completed');

  async function removeCharge(chargeId) {
    setBusy(true);
    const { error } = await supabase.rpc('bubatrent_admin_remove_booking_charge', {
      p_charge_id: chargeId,
      p_reason: removeReason,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    toast.success('Charge removed. Any part taken from the deposit went back to the customer.');
    setRemoving(null);
    setRemoveReason('');
    onChanged();
  }

  async function recordPayment() {
    const amount = Number(payAmount || owed);
    if (!(amount > 0)) {
      toast.error('Enter the amount received.');
      return;
    }
    setBusy(true);
    try {
      let receiptPath = null;
      if (payFile) {
        receiptPath = `receipts/${booking.id}/charge_${Date.now()}.${payFile.name.split('.').pop()}`;
        const { error: upErr } = await uploadFileRobust(
          'customer-documents',
          receiptPath,
          payFile,
          toast
        );
        if (upErr) throw upErr;
      }
      const { data, error } = await supabase.rpc('bubatrent_admin_record_charge_payment', {
        p_booking_id: booking.id,
        p_amount: amount,
        p_method: payMethod,
        p_receipt_path: receiptPath,
      });
      if (error) throw error;
      toast.success(
        Number(data?.still_owed) > 0
          ? `Payment recorded. Still owed: ${formatMYR(data.still_owed)}.`
          : 'Payment recorded. Nothing is owed now.'
      );
      setPayAmount('');
      setPayFile(null);
      onChanged();
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Wrench className="w-4 h-4" /> Return &amp; Charges
      </h3>

      {booking.deposit_on_hold && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-amber-300 flex-1 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            The {formatMYR(depositAvailable(booking))} deposit is on hold. Settle it once you know
            the cost of any damage.
          </p>
          <button
            onClick={() => setDialog('settle')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 whitespace-nowrap"
          >
            Settle Deposit
          </button>
        </div>
      )}

      {charges.length === 0 ? (
        <p className="text-sm text-slate-500">
          {booking.deposit_on_hold ? 'No charges yet.' : 'No charges. Returned without charges.'}
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {charges.map((c) => (
            <div key={c.id} className="py-2 first:pt-0 text-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-white">
                    {chargeLabel(c.kind)}
                    {c.description && <span className="text-slate-400"> — {c.description}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(c.created_at)} ·{' '}
                    {/* What's owed is tracked per booking, so a charge counts as
                        paid once nothing is owed on the booking */}
                    {Number(c.from_deposit) >= Number(c.amount)
                      ? 'from the deposit'
                      : Number(c.from_deposit) > 0
                        ? `${formatMYR(c.from_deposit)} from the deposit, rest ${owed > 0 ? 'owed' : 'paid separately'}`
                        : owed > 0
                          ? 'owed by the customer'
                          : 'paid separately'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-medium">{formatMYR(c.amount)}</p>
                  {!chargePaid && removing !== c.id && (
                    <button
                      onClick={() => {
                        setRemoving(c.id);
                        setRemoveReason('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {removing === c.id && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={removeReason}
                    onChange={(e) => setRemoveReason(e.target.value)}
                    placeholder="Why remove it? (required)"
                    className="input-field !py-1.5 text-xs flex-1"
                  />
                  <button
                    onClick={() => removeCharge(c.id)}
                    disabled={busy || !removeReason.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Remove charge
                  </button>
                  <button
                    onClick={() => setRemoving(null)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-white/5"
                  >
                    Keep
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="pt-2 flex justify-between text-sm">
            <span className="text-slate-400">Total charges</span>
            <span className="text-white font-semibold">
              {formatMYR(booking.charges_total || 0)}
            </span>
          </div>
        </div>
      )}

      {owed > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
          <p className="text-sm text-red-300 font-medium">
            Customer owes {formatMYR(owed)} (charges above the deposit)
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={`${owed.toFixed(2)}`}
              className="input-field !py-1.5 text-xs sm:w-28"
            />
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="input-field !py-1.5 text-xs sm:w-36"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer px-2">
              <FileImage className="w-3.5 h-3.5" />
              {payFile ? payFile.name : 'Receipt (optional)'}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setPayFile(e.target.files[0] || null)}
              />
            </label>
            <button
              onClick={recordPayment}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40"
            >
              {busy ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </div>
      )}

      {booking.status === 'RETURNED' && !booking.deposit_on_hold && (
        <button
          onClick={() => setDialog('add')}
          className="mt-4 text-xs text-violet-400 hover:text-violet-300"
        >
          + Add a charge found later
        </button>
      )}

      {dialog === 'settle' && (
        <ChargesDialog
          title="Settle held deposit"
          intro="Enter the charges (for example the repair quote). They come off the deposit; the rest goes to the customer's credit, and anything above the deposit is owed."
          booking={booking}
          rpc="bubatrent_admin_settle_deposit"
          deposit={depositAvailable(booking)}
          confirmLabel="Settle Deposit"
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
      {dialog === 'add' && (
        <ChargesDialog
          title="Add a charge"
          intro="The deposit was already settled, so these charges are owed by the customer. Record the payment when you collect it."
          booking={booking}
          rpc="bubatrent_admin_add_booking_charges"
          deposit={0}
          confirmLabel="Add Charge"
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
