import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { AlertTriangle, EyeOff, FileBadge, FileImage, History, Plus } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Modal } from '../../components/ReturnCharges';
import { SignedLink } from '../../components/SignedFile';
import { useToast } from '../../components/Toast';
import { useAdminCars, useCarDocuments, updateCar } from '../../hooks/useAdmin';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { uploadFileRobust } from '../../lib/uploadHelper';
import {
  DOC_LABELS,
  DOC_TYPES,
  DUE_SOON_DAYS,
  daysLeft,
  daysLeftLabel,
  documentAlerts,
  documentStatus,
  latestByType,
} from '../../utils/carDocuments';
import { friendlyDbError } from '../../utils/dbErrors';
import { formatDate, formatDateTime } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';

// Road tax, insurance, Puspakom and GPS of each car. A renewal is recorded
// with its receipt or certificate by bubatrent_admin_add_car_document; every
// renewal is kept as the car's history.

const BUCKET = 'customer-documents';

const PROVIDER_HINTS = {
  road_tax: 'e.g. JPJ, MyEG',
  insurance: 'e.g. P&O, Etiqa Takaful',
  puspakom: 'e.g. Puspakom Cheras',
  gps: 'e.g. Tracksolid',
};

const STATUS_TEXT = {
  expired: 'text-red-400',
  due_soon: 'text-amber-300',
  valid: 'text-green-400',
};

function carLabel(car) {
  return car.plate_number ? `${car.plate_number} (${car.name})` : car.name;
}

function RenewalDialog({ car, docType, previous, onClose, onDone }) {
  const toast = useToast();
  const [type, setType] = useState(docType || 'road_tax');
  // A renewal usually starts the day after the old one ends
  const prevEnd = previous?.[type]?.valid_until;
  const [validFrom, setValidFrom] = useState(
    prevEnd ? format(addDays(parseISO(prevEnd), 1), 'yyyy-MM-dd') : ''
  );
  const [validUntil, setValidUntil] = useState('');
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  function changeType(next) {
    setType(next);
    const end = previous?.[next]?.valid_until;
    setValidFrom(end ? format(addDays(parseISO(end), 1), 'yyyy-MM-dd') : '');
  }

  async function submit() {
    if (!validUntil) {
      toast.error('Enter the date it is valid until.');
      return;
    }
    if (validFrom && validFrom > validUntil) {
      toast.error('The start date is after the expiry date.');
      return;
    }
    if (amount !== '' && !(Number(amount) >= 0)) {
      toast.error('Enter the cost in ringgit, or leave it blank.');
      return;
    }
    if (files.length === 0) {
      toast.error('Add the receipt or certificate (a photo or PDF).');
      return;
    }
    setSaving(true);
    // Files go up first, into the folder of the record the database creates
    const docId = crypto.randomUUID();
    const paths = [];
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `car-documents/${docId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, path, file, toast);
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { error } = await supabase.rpc('bubatrent_admin_add_car_document', {
        p_id: docId,
        p_car_id: car.id,
        p_doc_type: type,
        p_valid_from: validFrom || null,
        p_valid_until: validUntil,
        p_amount: amount === '' ? null : Math.round(Number(amount) * 100) / 100,
        p_provider: provider,
        p_reference: reference,
        p_file_paths: paths,
      });
      if (error) throw error;
      toast.success(
        `${DOC_LABELS[type]} for ${car.plate_number || car.name} recorded, valid until ${formatDate(validUntil)}.`
      );
      onDone();
    } catch (err) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      toast.error(friendlyDbError(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Record a renewal: ${carLabel(car)}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">Document</label>
            <select
              value={type}
              onChange={(e) => changeType(e.target.value)}
              className="input-field !py-1.5 text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Valid until *</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Valid from</label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Cost (RM)</label>
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
            <label className="input-label">Paid to</label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder={PROVIDER_HINTS[type]}
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Receipt or policy number</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="input-field !py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="input-label">Receipt or certificate *</label>
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
            It should show the plate number and the dates it covers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Record Renewal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DocTile({ type, doc, onRenew }) {
  const status = doc ? documentStatus(doc.valid_until) : null;
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 flex flex-col gap-1">
      <p className="text-xs text-slate-500">{DOC_LABELS[type]}</p>
      {doc ? (
        <>
          <p className={`text-sm font-medium ${STATUS_TEXT[status]}`}>
            {status === 'expired' ? 'Expired' : 'Valid until'} {formatDate(doc.valid_until)}
          </p>
          {status !== 'valid' && (
            <p className={`text-[11px] ${STATUS_TEXT[status]}`}>
              {daysLeftLabel(daysLeft(doc.valid_until))}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">Not on record</p>
      )}
      <button
        onClick={onRenew}
        className="text-[11px] text-violet-400 hover:text-violet-300 text-left mt-auto pt-1"
      >
        {doc ? 'Record renewal' : '+ Add'}
      </button>
    </div>
  );
}

function HistoryList({ docs, onChanged }) {
  const toast = useToast();
  const [removing, setRemoving] = useState(null); // document id
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function remove(id) {
    setBusy(true);
    const { data, error } = await supabase.rpc('bubatrent_admin_remove_car_document', {
      p_id: id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    if (data?.files?.length) await supabase.storage.from(BUCKET).remove(data.files);
    toast.success('Removed. The audit log keeps what it said.');
    setRemoving(null);
    setReason('');
    onChanged();
  }

  return (
    <div className="divide-y divide-white/5 mt-3">
      {docs.map((d) => (
        <div key={d.id} className="py-2 text-sm">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white">
                {DOC_LABELS[d.doc_type]}
                <span className="text-slate-400">
                  {' '}
                  — {d.valid_from ? `${formatDate(d.valid_from)} to ` : 'until '}
                  {formatDate(d.valid_until)}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {[d.provider, d.reference].filter(Boolean).join(' · ')}
                {(d.provider || d.reference) && ' · '}
                recorded {formatDateTime(d.created_at)}
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                {d.file_paths.map((p, i) => (
                  <SignedLink
                    key={p}
                    path={p}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <FileImage className="w-3 h-3" /> File {i + 1}
                  </SignedLink>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              {d.amount != null && <p className="text-white font-medium">{formatMYR(d.amount)}</p>}
              {removing !== d.id && (
                <button
                  onClick={() => {
                    setRemoving(d.id);
                    setReason('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {removing === d.id && (
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why remove it? (required)"
                className="input-field !py-1.5 text-xs flex-1"
              />
              <button
                onClick={() => remove(d.id)}
                disabled={busy || !reason.trim()}
                className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
              >
                Remove record
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
    </div>
  );
}

export default function AdminCarDocuments() {
  const toast = useToast();
  const { activeFleetId } = useFleet();
  const { cars, loading: carsLoading, refetch: refetchCars } = useAdminCars(activeFleetId);
  const { documents, loading: docsLoading, error, refetch } = useCarDocuments(activeFleetId);
  const [dialog, setDialog] = useState(null); // { car, docType }
  const [openHistory, setOpenHistory] = useState({}); // car id -> true
  const [hiding, setHiding] = useState(null); // car id

  if (carsLoading || docsLoading)
    return (
      <AdminLayout title="Car Documents">
        <LoadingSpinner />
      </AdminLayout>
    );

  const docsByCar = {};
  for (const d of documents) {
    if (!docsByCar[d.car_id]) docsByCar[d.car_id] = [];
    docsByCar[d.car_id].push(d);
  }
  const alerts = documentAlerts(cars, documents);
  // Cars with documents, the most urgent first; the rest listed below
  const urgency = (car) => {
    const left = Object.values(latestByType(docsByCar[car.id] || [])).map((d) =>
      daysLeft(d.valid_until)
    );
    return left.length ? Math.min(...left) : Infinity;
  };
  const tracked = cars
    .filter((c) => docsByCar[c.id])
    .sort(
      (a, b) =>
        urgency(a) - urgency(b) || (a.plate_number || '').localeCompare(b.plate_number || '')
    );
  const untracked = cars.filter((c) => !docsByCar[c.id]);

  async function hide(car) {
    setHiding(car.id);
    try {
      await updateCar(car.id, { is_available: false });
      toast.success(`${car.plate_number || car.name} is hidden from the website.`);
      refetchCars();
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setHiding(null);
    }
  }

  return (
    <AdminLayout title="Car Documents">
      <p className="text-sm text-slate-400 mb-6">
        Road tax, insurance, Puspakom and GPS for each car. Record every renewal with its receipt or
        certificate. The dashboard warns you {DUE_SOON_DAYS} days before one expires.
      </p>

      {error && (
        <div className="glass-card text-center mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="glass-card mb-6 border-red-500/20 bg-red-500/5">
          <h2 className="text-sm font-semibold text-red-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Expired or expiring soon
          </h2>
          <div className="divide-y divide-white/5">
            {alerts.map(({ car, doc, status, daysLeft: left }) => (
              <div
                key={doc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5"
              >
                <div className="text-sm">
                  <span className="text-white">{car.plate_number || car.name}</span>
                  <span className="text-slate-400"> · {DOC_LABELS[doc.doc_type]} </span>
                  <span className={STATUS_TEXT[status]}>
                    {status === 'expired' ? 'expired' : 'expires'} {formatDate(doc.valid_until)} (
                    {daysLeftLabel(left)})
                  </span>
                  {status === 'expired' && car.is_available && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                      Still on the website
                    </span>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  {status === 'expired' && car.is_available && (
                    <button
                      onClick={() => hide(car)}
                      disabled={hiding === car.id}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 disabled:opacity-40"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Hide from website
                    </button>
                  )}
                  <button
                    onClick={() => setDialog({ car, docType: doc.doc_type })}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    Record renewal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tracked.map((car) => {
          const docs = docsByCar[car.id];
          const latest = latestByType(docs);
          return (
            <div key={car.id} className="glass-card">
              <div className="flex items-center gap-2 mb-3">
                <Link
                  to={`/admin/cars/${car.id}/history`}
                  className="text-white font-semibold truncate hover:text-violet-300"
                >
                  {car.name}
                </Link>
                {car.plate_number && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 shrink-0">
                    {car.plate_number}
                  </span>
                )}
                {!car.is_available && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DOC_TYPES.map((t) => (
                  <DocTile
                    key={t.id}
                    type={t.id}
                    doc={latest[t.id]}
                    onRenew={() => setDialog({ car, docType: t.id })}
                  />
                ))}
              </div>
              <button
                onClick={() => setOpenHistory({ ...openHistory, [car.id]: !openHistory[car.id] })}
                className="mt-3 text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" />
                {openHistory[car.id] ? 'Hide history' : `History (${docs.length})`}
              </button>
              {openHistory[car.id] && <HistoryList docs={docs} onChanged={refetch} />}
            </div>
          );
        })}
      </div>

      {untracked.length > 0 && (
        <div className="glass-card mt-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <FileBadge className="w-4 h-4" /> No documents on record
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Add the current road tax and insurance of each car you still rent out, so you are warned
            before they expire.
          </p>
          <div className="divide-y divide-white/5">
            {untracked.map((car) => (
              <div key={car.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-slate-300 truncate">
                  {carLabel(car)}
                  {!car.is_available && <span className="text-slate-500"> · unavailable</span>}
                </span>
                <button
                  onClick={() => setDialog({ car, docType: 'road_tax' })}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add document
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {dialog && (
        <RenewalDialog
          car={dialog.car}
          docType={dialog.docType}
          previous={latestByType(docsByCar[dialog.car.id] || [])}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refetch();
          }}
        />
      )}
    </AdminLayout>
  );
}
