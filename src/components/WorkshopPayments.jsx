import { useState } from 'react';
import { AlertTriangle, FileImage, Hammer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileRobust } from '../lib/uploadHelper';
import { useToast } from './Toast';
import { Modal } from './ReturnCharges';
import { SignedLink } from './SignedFile';
import { friendlyDbError } from '../utils/dbErrors';
import { formatDate, getTodayString } from '../utils/dates';
import { formatMYR } from '../utils/pricing';
import { WORKSHOP_STATUSES, rentDue, workshopPayments, workshopSplit } from '../utils/workshop';

// Repairs the customer paid the workshop for directly, taken off what they owe
// us (a contra). The money moves happen in the database functions
// bubatrent_admin_record_workshop_payment / _remove_workshop_payment; the
// repair also becomes a paid expense of the car.

const BUCKET = 'customer-documents';

function RecordDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const [workshop, setWorkshop] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(getTodayString());
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  // The same order the database uses: rental still to pay, charges owed, credit
  const value = Number(amount) > 0 ? Math.round(Number(amount) * 100) / 100 : 0;
  const rentLeft = booking.full_payment_status === 'verified' ? 0 : rentDue(booking);
  const owed = Number(booking.amount_owed || 0);
  const toRent = Math.min(value, rentLeft);
  const toCharges = Math.min(value - toRent, owed);
  const toCredit = value - toRent - toCharges;
  const car = booking.bubatrent_booking_cars;

  async function submit() {
    if (!workshop.trim()) {
      toast.error('Enter the workshop’s name.');
      return;
    }
    if (!description.trim()) {
      toast.error('Describe the repair.');
      return;
    }
    if (!(value > 0)) {
      toast.error('Enter the amount the customer paid the workshop.');
      return;
    }
    if (!paidOn || paidOn > getTodayString()) {
      toast.error('Enter the date the customer paid (not in the future).');
      return;
    }
    if (files.length === 0) {
      toast.error('Add a photo of the workshop’s bill or receipt.');
      return;
    }
    setSaving(true);
    // Files go up first, into the folder of the expense the database creates
    const claimId = crypto.randomUUID();
    const paths = [];
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `expenses/${claimId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, path, file, toast);
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { data, error } = await supabase.rpc('bubatrent_admin_record_workshop_payment', {
        p_booking_id: booking.id,
        p_claim_id: claimId,
        p_workshop: workshop,
        p_description: description,
        p_paid_on: paidOn,
        p_amount: value,
        p_file_paths: paths,
      });
      if (error) throw error;
      toast.success(
        `Recorded: ${workshopSplit(data)}.${data?.rent_verified ? ' The rental is now fully paid.' : ''}`
      );
      onDone();
    } catch (err) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      toast.error(friendlyDbError(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="Customer paid a workshop for us" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">
          For a repair that is ours to pay, when the customer paid the workshop and takes it off
          what they owe us. If the customer caused the damage, it is their cost: don&apos;t record
          it here.
        </p>

        {booking.full_payment_status === 'uploaded' && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            The customer uploaded a rental payment receipt that isn&apos;t verified yet. If it
            already covers the full rental, verify it first, so this goes to their credit instead.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">Workshop</label>
            <input
              type="text"
              value={workshop}
              onChange={(e) => setWorkshop(e.target.value)}
              placeholder="e.g. Bengkel Ah Seng, Kajang"
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">What was repaired</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Radiator hose replaced"
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Amount paid (RM)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Date the customer paid</label>
            <input
              type="date"
              value={paidOn}
              max={getTodayString()}
              onChange={(e) => setPaidOn(e.target.value)}
              className="input-field !py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="input-label">Workshop&apos;s bill and receipt</label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer bg-white/5 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors">
            <FileImage className="w-3.5 h-3.5" />
            {files.length ? files.map((f) => f.name).join(', ') : 'Choose photos or PDF'}
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </label>
          <p className="text-xs text-slate-500 mt-1">
            Show the car&apos;s plate and that it is paid. The first file is kept as the proof of
            payment.
          </p>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-3 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Rental still to pay</span>
            <span className="text-white">{formatMYR(rentLeft)}</span>
          </div>
          {owed > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Charges owed</span>
              <span className="text-white">{formatMYR(owed)}</span>
            </div>
          )}
          {value > 0 && (
            <>
              <div className="flex justify-between border-t border-white/5 pt-1">
                <span className="text-slate-400">Taken off the rental</span>
                <span className="text-white">{formatMYR(toRent)}</span>
              </div>
              {owed > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Taken off charges owed</span>
                  <span className="text-white">{formatMYR(toCharges)}</span>
                </div>
              )}
              {toCredit > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">To the customer&apos;s credit</span>
                  <span className="text-green-400 font-semibold">{formatMYR(toCredit)}</span>
                </div>
              )}
              {rentLeft > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">The customer then pays us</span>
                  <span className="text-white font-semibold">{formatMYR(rentLeft - toRent)}</span>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-slate-500 pt-1">
            The repair is added to Expenses for {car?.name || 'this car'}
            {car?.plate_number ? ` (${car.plate_number})` : ''} as paid by the customer, so Sales
            shows the full rental and the repair cost.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Record Workshop Payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** The booking page card: workshop payments, record one, remove a mistake. */
export function WorkshopPaymentsCard({ booking, onChanged }) {
  const toast = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [removing, setRemoving] = useState(null); // workshop payment id
  const [removeReason, setRemoveReason] = useState('');
  const [busy, setBusy] = useState(false);
  const list = workshopPayments(booking);

  async function remove(id) {
    setBusy(true);
    const { data, error } = await supabase.rpc('bubatrent_admin_remove_workshop_payment', {
      p_id: id,
      p_reason: removeReason,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    if (data?.files?.length) await supabase.storage.from(BUCKET).remove(data.files);
    toast.success('Workshop payment removed, with its expense.');
    setRemoving(null);
    setRemoveReason('');
    onChanged();
  }

  return (
    <div className="glass-card">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Hammer className="w-4 h-4" /> Paid to Workshop
      </h3>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          If the customer paid a workshop for a repair we should pay, record it here. It comes off
          what they owe us.
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {list.map((w) => {
            const files =
              w.bubatrent_booking_expense_claims?.bubatrent_booking_expense_images || [];
            return (
              <div key={w.id} className="py-2 first:pt-0 text-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-white">
                      {w.workshop}
                      <span className="text-slate-400"> — {w.description}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Paid {formatDate(w.paid_on)} · {workshopSplit(w)}
                    </p>
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-1">
                        {files.map((f, i) => (
                          <SignedLink
                            key={f.file_path}
                            path={f.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                          >
                            <FileImage className="w-3 h-3" /> File {i + 1}
                          </SignedLink>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-medium">{formatMYR(w.amount)}</p>
                    {removing !== w.id && (
                      <button
                        onClick={() => {
                          setRemoving(w.id);
                          setRemoveReason('');
                        }}
                        className="text-[11px] text-slate-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {removing === w.id && (
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={removeReason}
                      onChange={(e) => setRemoveReason(e.target.value)}
                      placeholder="Why remove it? (required)"
                      className="input-field !py-1.5 text-xs flex-1"
                    />
                    <button
                      onClick={() => remove(w.id)}
                      disabled={busy || !removeReason.trim()}
                      className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                    >
                      Remove payment
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
            );
          })}
        </div>
      )}

      {WORKSHOP_STATUSES.includes(booking.status) && (
        <button
          onClick={() => setShowDialog(true)}
          className="mt-4 text-xs text-violet-400 hover:text-violet-300"
        >
          + Customer paid a workshop for us
        </button>
      )}

      {showDialog && (
        <RecordDialog
          booking={booking}
          onClose={() => setShowDialog(false)}
          onDone={() => {
            setShowDialog(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
