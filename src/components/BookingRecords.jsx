import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileImage, FolderOpen, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileRobust } from '../lib/uploadHelper';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { SignedLink } from './SignedFile';
import { friendlyDbError } from '../utils/dbErrors';
import { formatDateTime } from '../utils/dates';

// Files kept on a booking (bubatrent_booking_records): the chat that
// arranged it, a paper agreement, receipts, deposit refunds. Rentals made on
// WhatsApp before the website have their proof here.

const BUCKET = 'customer-documents';

const RECORD_KINDS = [
  { id: 'chat_proof', label: 'Chat proof' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'payment_receipt', label: 'Payment receipt' },
  { id: 'refund', label: 'Deposit refund' },
  { id: 'photo', label: 'Photo' },
  { id: 'other', label: 'Other' },
];

const KIND_LABELS = Object.fromEntries(RECORD_KINDS.map((k) => [k.id, k.label]));

function useBookingRecords(bookingId) {
  const { data = [], refetch } = useQuery({
    queryKey: ['booking-records', bookingId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('bubatrent_booking_records')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at');
      if (error) throw error;
      return rows || [];
    },
    enabled: !!bookingId,
  });
  return { records: data, refetch };
}

export function BookingRecordsCard({ bookingId }) {
  const toast = useToast();
  const { user } = useAuth();
  const { records, refetch } = useBookingRecords(bookingId);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState('chat_proof');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null); // record id

  async function add() {
    if (files.length === 0) {
      toast.error('Choose a photo or PDF.');
      return;
    }
    setBusy(true);
    const paths = [];
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `booking-records/${bookingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, path, file, toast);
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { error } = await supabase.from('bubatrent_booking_records').insert(
        paths.map((file_path) => ({
          booking_id: bookingId,
          kind,
          file_path,
          note: note.trim() || null,
          created_by: user.id,
        }))
      );
      if (error) throw error;
      toast.success(paths.length > 1 ? `${paths.length} files added.` : 'File added.');
      setAdding(false);
      setNote('');
      setFiles([]);
      refetch();
    } catch (err) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      toast.error(friendlyDbError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(record) {
    setBusy(true);
    const { error } = await supabase.from('bubatrent_booking_records').delete().eq('id', record.id);
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    await supabase.storage.from(BUCKET).remove([record.file_path]);
    toast.success('Removed. The audit log keeps a note of it.');
    setRemoving(null);
    refetch();
  }

  return (
    <div className="glass-card">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <FolderOpen className="w-4 h-4" /> Records
      </h3>

      {records.length === 0 ? (
        <p className="text-xs text-slate-500">
          Keep the chat that arranged the rental, a paper agreement or deposit refund proof here.
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {records.map((r) => (
            <div key={r.id} className="py-2 first:pt-0 text-sm">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <SignedLink
                    path={r.file_path}
                    className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <FileImage className="w-3.5 h-3.5 shrink-0" /> {KIND_LABELS[r.kind] || r.kind}
                  </SignedLink>
                  {r.note && <p className="text-xs text-slate-400 mt-0.5">{r.note}</p>}
                  <p className="text-[11px] text-slate-600">{formatDateTime(r.created_at)}</p>
                </div>
                {removing === r.id ? (
                  <div className="flex gap-2 shrink-0 items-start">
                    <button
                      onClick={() => remove(r)}
                      disabled={busy}
                      className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setRemoving(null)}
                      className="text-[11px] text-slate-500 hover:text-white"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRemoving(r.id)}
                    className="text-[11px] text-slate-500 hover:text-red-400 shrink-0 self-start"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="mt-4 space-y-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="input-field !py-1.5 text-sm"
          >
            {RECORD_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="input-field !py-1.5 text-sm"
          />
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
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="btn-secondary flex-1 !py-1.5 text-sm"
            >
              Cancel
            </button>
            <button onClick={add} disabled={busy} className="btn-primary flex-1 !py-1.5 text-sm">
              {busy ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add a record
        </button>
      )}
    </div>
  );
}
