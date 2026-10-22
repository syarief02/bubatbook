import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Banknote,
  CalendarPlus,
  Car,
  CheckCircle2,
  History,
  KeyRound,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Search,
  UserPlus,
  Wallet,
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Modal, ReturnCarDialog } from '../../components/ReturnCharges';
import { RentalChangesCard } from '../../components/RentalChanges';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useAdminCars } from '../../hooks/useAdmin';
import { useLongRentalRates } from '../../hooks/useCars';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { uploadFileRobust } from '../../lib/uploadHelper';
import { formatDate, getTodayString } from '../../utils/dates';
import { friendlyDbError } from '../../utils/dbErrors';
import { normalizePhone } from '../../utils/phoneUtils';
import { calculatePrice, formatMYR } from '../../utils/pricing';
import { RENTAL_CHANGES_SELECT } from '../../utils/rent';
import { ilikeAny } from '../../utils/search';

// The Counter: record any rental in a few taps, POS style. Tap a car, say
// what is happening (a new booking, on rent now, or a past rental), fill in
// the customer, dates and what was paid, and save. Rentals arranged on
// WhatsApp and past ones already paid go in the same way
// (bubatrent_admin_record_rental). A car that is out shows its rental, with
// Add payment, Mark returned and the usual rental changes.

const BUCKET = 'customer-documents';
const OPEN_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'];

const MODES = {
  CONFIRMED: {
    label: 'New booking',
    hint: 'Starts later. Needs a verified customer.',
    icon: CalendarPlus,
    tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  },
  PICKUP: {
    label: 'On rent now',
    hint: 'The customer has the car (e.g. agreed on WhatsApp).',
    icon: KeyRound,
    tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  },
  RETURNED: {
    label: 'Past rental',
    hint: 'Already back. Record what was paid.',
    icon: History,
    tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  },
};

const DURATIONS = [
  ['1 day', 1],
  ['3 days', 3],
  ['1 week', 7],
  ['2 weeks', 14],
  ['1 month', 30],
];

const ymd = (d) => format(d, 'yyyy-MM-dd');
const plus = (date, days) => ymd(addDays(parseISO(date), days));

function rentDue(b) {
  return b.full_payment_status === 'verified'
    ? 0
    : Math.max(Number(b.total_price || 0) - Number(b.rent_paid || 0), 0);
}

function waLink(phone) {
  const digits = normalizePhone(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/** Open rentals, and finished ones with money still to settle. */
function useCounterBookings(fleetId) {
  return useQuery({
    queryKey: ['counter', fleetId],
    queryFn: async () => {
      let query = supabase
        .from('bubatrent_booking_bookings')
        .select(`*, bubatrent_booking_cars(*), ${RENTAL_CHANGES_SELECT}`)
        .or(
          `status.in.(${OPEN_STATUSES.join(',')}),and(status.eq.RETURNED,deposit_credited_at.is.null),and(status.eq.RETURNED,full_payment_status.neq.verified)`
        )
        .order('pickup_date');
      if (fleetId) query = query.eq('fleet_group_id', fleetId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export default function AdminCounter() {
  const { activeFleetId, activeFleet } = useFleet();
  const { cars, loading: carsLoading, refetch: refetchCars } = useAdminCars(activeFleetId);
  const { data: bookings = [], isLoading, refetch } = useCounterBookings(activeFleetId);
  const [search, setSearch] = useState('');
  const [sheetCar, setSheetCar] = useState(null);
  const [form, setForm] = useState(null); // { car, mode }
  const [openBookingId, setOpenBookingId] = useState(null);
  const [attention, setAttention] = useState(null); // key of NEEDS
  const today = getTodayString();

  const reload = () => {
    refetch();
    refetchCars();
  };

  const byCar = useMemo(() => {
    const map = {};
    for (const b of bookings) {
      if (!map[b.car_id]) map[b.car_id] = { out: null, next: [] };
      if (b.status === 'PICKUP') map[b.car_id].out = b;
      else if (b.status === 'DEPOSIT_PAID' || b.status === 'CONFIRMED') map[b.car_id].next.push(b);
    }
    return map;
  }, [bookings]);

  const needs = useMemo(() => {
    const overdue = bookings.filter((b) => b.status === 'PICKUP' && b.return_date < today);
    const rentOwed = bookings.filter(
      (b) => ['PICKUP', 'RETURNED'].includes(b.status) && rentDue(b) > 0
    );
    const toRefund = bookings.filter(
      (b) =>
        b.status === 'RETURNED' &&
        !b.user_id &&
        Number(b.deposit_amount) > 0 &&
        !b.deposit_credited_at &&
        !b.deposit_on_hold
    );
    const onHold = bookings.filter((b) => b.status === 'RETURNED' && b.deposit_on_hold);
    return {
      overdue: { label: 'Overdue returns', items: overdue, tone: 'text-red-300' },
      rentOwed: {
        label: `Rent owed ${formatMYR(rentOwed.reduce((s, b) => s + rentDue(b), 0))}`,
        items: rentOwed,
        tone: 'text-amber-300',
      },
      toRefund: { label: 'Deposits to refund', items: toRefund, tone: 'text-sky-300' },
      onHold: { label: 'Deposits on hold', items: onHold, tone: 'text-violet-300' },
    };
  }, [bookings, today]);

  const q = search.trim().toLowerCase().replace(/\s/g, '');
  // Cars that are out first, then booked, available, and hidden last
  const rank = (c) =>
    byCar[c.id]?.out ? 0 : byCar[c.id]?.next?.length ? 1 : c.is_available ? 2 : 3;
  const shownCars = cars
    .filter(
      (c) =>
        !q ||
        (c.plate_number || '').toLowerCase().replace(/\s/g, '').includes(q) ||
        (c.name || '').toLowerCase().replace(/\s/g, '').includes(q) ||
        (byCar[c.id]?.out?.customer_name || '').toLowerCase().replace(/\s/g, '').includes(q)
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) || (a.plate_number || a.name).localeCompare(b.plate_number || b.name)
    );
  const openBooking = bookings.find((b) => b.id === openBookingId) || null;

  return (
    <AdminLayout title="Counter">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <p className="text-sm text-slate-400 flex-1">
          Tap a car to record a rental: a new booking, one that is on rent now, or a past one.
          Everything you record here goes to Bookings, Sales and Customer History.
        </p>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Plate, car or customer..."
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Needs attention */}
      {Object.values(needs).some((n) => n.items.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(needs)
            .filter(([, n]) => n.items.length > 0)
            .map(([key, n]) => (
              <button
                key={key}
                onClick={() => setAttention(key)}
                className={`px-3 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1.5 ${n.tone}`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {n.label} · {n.items.length}
              </button>
            ))}
        </div>
      )}

      {carsLoading || isLoading ? (
        <LoadingSpinner />
      ) : cars.length === 0 ? (
        <div className="glass-card text-center text-sm text-slate-400">
          No cars in {activeFleet?.name || 'this fleet'} yet. Add them in Cars.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {shownCars.map((car) => (
            <CarTile
              key={car.id}
              car={car}
              state={byCar[car.id]}
              today={today}
              onClick={() => setSheetCar(car)}
            />
          ))}
        </div>
      )}

      {sheetCar && (
        <CarSheet
          car={sheetCar}
          state={byCar[sheetCar.id]}
          onClose={() => setSheetCar(null)}
          onRecord={(mode) => {
            setForm({ car: sheetCar, mode });
            setSheetCar(null);
          }}
          onOpenBooking={(id) => {
            setOpenBookingId(id);
            setSheetCar(null);
          }}
        />
      )}

      {form && (
        <RecordRentalDialog
          car={form.car}
          initialMode={form.mode}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null);
            reload();
          }}
        />
      )}

      {openBooking && (
        <RentalPanel
          booking={openBooking}
          onClose={() => setOpenBookingId(null)}
          onChanged={reload}
        />
      )}

      {attention && (
        <Modal title={needs[attention].label} onClose={() => setAttention(null)}>
          <div className="space-y-2">
            {needs[attention].items.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setAttention(null);
                  setOpenBookingId(b.id);
                }}
                className="w-full text-left flex justify-between gap-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] px-3 py-2.5 text-sm"
              >
                <span>
                  <span className="text-white">{b.customer_name || 'Customer'}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {b.bubatrent_booking_cars?.plate_number} · {formatDate(b.pickup_date)} –{' '}
                    {formatDate(b.actual_return_date || b.return_date)}
                  </span>
                </span>
                <span className="text-slate-300 shrink-0">
                  {attention === 'rentOwed'
                    ? formatMYR(rentDue(b))
                    : attention === 'overdue'
                      ? `due ${formatDate(b.return_date)}`
                      : formatMYR(b.deposit_amount)}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

function CarTile({ car, state, today, onClick }) {
  const out = state?.out;
  const next = state?.next?.[0];
  let status;
  if (out) {
    const late = out.return_date < today;
    status = {
      text: late ? `Overdue · ${out.customer_name || ''}` : `On rent · ${out.customer_name || ''}`,
      sub: `${late ? 'was due' : 'until'} ${formatDate(out.return_date)}`,
      cls: late ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300',
    };
  } else if (next) {
    status = {
      text: `Booked ${formatDate(next.pickup_date)}`,
      sub: next.customer_name || '',
      cls: 'bg-sky-500/15 text-sky-300',
    };
  } else if (!car.is_available) {
    status = { text: 'Hidden from the website', sub: '', cls: 'bg-white/5 text-slate-400' };
  } else {
    status = { text: 'Available', sub: '', cls: 'bg-emerald-500/15 text-emerald-300' };
  }
  return (
    <button
      onClick={onClick}
      className="glass-card !p-0 overflow-hidden text-left hover:ring-2 hover:ring-violet-500/40 active:scale-[0.98] transition-all"
    >
      <div className="h-24 sm:h-28 bg-dark-800 relative">
        {car.image_url ? (
          <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-8 h-8 text-slate-700" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-white">
          {car.plate_number || '—'}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm text-white font-medium truncate">{car.name}</p>
        <p className="text-[11px] text-slate-500">{formatMYR(car.price_per_day)}/day</p>
        <div className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] ${status.cls}`}>
          <p className="font-medium truncate">{status.text}</p>
          {status.sub && <p className="opacity-80 truncate">{status.sub}</p>}
        </div>
      </div>
    </button>
  );
}

function CarSheet({ car, state, onClose, onRecord, onOpenBooking }) {
  const rentals = [state?.out, ...(state?.next || [])].filter(Boolean);
  return (
    <Modal title={`${car.plate_number || ''} · ${car.name}`} onClose={onClose}>
      {rentals.length > 0 && (
        <div className="space-y-2 mb-5">
          {rentals.map((b) => (
            <button
              key={b.id}
              onClick={() => onOpenBooking(b.id)}
              className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] p-3"
            >
              <p className="text-sm text-white">
                {b.status === 'PICKUP' ? 'On rent' : 'Booked'}: {b.customer_name || 'Customer'}
              </p>
              <p className="text-xs text-slate-400">
                {formatDate(b.pickup_date)} – {formatDate(b.return_date)} · rent{' '}
                {formatMYR(b.total_price)}
                {rentDue(b) > 0 ? ` · ${formatMYR(rentDue(b))} to pay` : ' · paid'}
              </p>
              <p className="text-[11px] text-violet-300 mt-1">
                Tap for payments, return and changes →
              </p>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 mb-2">Record a rental for this car</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(MODES).map(([mode, m]) => {
          const Icon = m.icon;
          return (
            <button
              key={mode}
              onClick={() => onRecord(mode)}
              className={`rounded-2xl border p-4 text-left hover:brightness-125 active:scale-[0.98] transition-all ${m.tone}`}
            >
              <Icon className="w-6 h-6 mb-2" />
              <p className="font-semibold">{m.label}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{m.hint}</p>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ─── Record a rental ───

function defaultDates(mode, today) {
  if (mode === 'CONFIRMED') return [plus(today, 1), plus(today, 4)];
  if (mode === 'PICKUP') return [today, plus(today, 3)];
  return [plus(today, -3), today];
}

function RecordRentalDialog({ car, initialMode, onClose, onDone }) {
  const toast = useToast();
  const { user } = useAuth();
  const rates = useLongRentalRates(car.fleet_group_id);
  const today = getTodayString();
  const [mode, setMode] = useState(initialMode);
  const [customer, setCustomer] = useState(null); // { id?, name, phone, verified }
  const [[pickup, ret], setDates] = useState(() => defaultDates(initialMode, today));
  const [datesTouched, setDatesTouched] = useState(false);
  const [agreed, setAgreed] = useState(''); // '' = the car's price
  const [deposit, setDeposit] = useState('');
  const [paidChoice, setPaidChoice] = useState(initialMode === 'RETURNED' ? 'full' : 'none');
  const [paidPart, setPaidPart] = useState('');
  const [method, setMethod] = useState('cash');
  const [paidOn, setPaidOn] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [proof, setProof] = useState([]);
  const [depositOutcome, setDepositOutcome] = useState('refunded');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const estimate = calculatePrice(car.price_per_day, pickup, ret, rates);
  const total = agreed === '' ? estimate.total : Number(agreed) || 0;
  const depositValue =
    deposit === '' ? (mode === 'CONFIRMED' ? estimate.deposit : 0) : Number(deposit) || 0;
  const paid = paidChoice === 'full' ? total : paidChoice === 'part' ? Number(paidPart) || 0 : 0;

  function pickMode(next) {
    setMode(next);
    if (!datesTouched) setDates(defaultDates(next, today));
    setPaidChoice(next === 'RETURNED' ? 'full' : 'none');
  }

  async function save() {
    if (!customer) {
      toast.error('Choose the customer, or add a new one.');
      return;
    }
    if (estimate.days < 1) {
      toast.error('The return date must be after the pick-up date.');
      return;
    }
    if (paidChoice === 'part' && !(paid > 0)) {
      toast.error('Enter how much rent was paid.');
      return;
    }
    setSaving(true);
    const id = crypto.randomUUID();
    const uploaded = [];
    try {
      let receiptPath = null;
      if (receipt && paid > 0) {
        receiptPath = `receipts/${id}/rent_${Date.now()}.${receipt.name.split('.').pop()}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, receiptPath, receipt, toast);
        if (upErr) throw upErr;
        uploaded.push(receiptPath);
      }
      const { error } = await supabase.rpc('bubatrent_admin_record_rental', {
        p_id: id,
        p_car_id: car.id,
        p_status: mode,
        p_pickup: pickup,
        p_return: ret,
        p_customer_id: customer.id || null,
        p_customer_name: customer.name,
        p_customer_phone: customer.phone,
        p_total: total,
        p_deposit: depositValue,
        p_paid: paid,
        p_method: method,
        p_paid_on: paid > 0 || depositValue > 0 ? paidOn || null : null,
        p_receipt_path: receiptPath,
        p_actual_return: mode === 'RETURNED' ? ret : null,
        p_deposit_outcome: mode === 'RETURNED' && depositValue > 0 ? depositOutcome : null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      uploaded.length = 0; // the booking owns the receipt now

      // Chat screenshots or the agreement: kept with the booking
      if (proof.length) {
        const paths = [];
        for (const file of proof) {
          const path = `booking-records/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
          const { error: upErr } = await uploadFileRobust(BUCKET, path, file, toast);
          if (!upErr) paths.push(path);
        }
        if (paths.length) {
          const { error: recErr } = await supabase.from('bubatrent_booking_records').insert(
            paths.map((file_path) => ({
              booking_id: id,
              kind: 'chat_proof',
              file_path,
              note: 'Added at the Counter',
              created_by: user.id,
            }))
          );
          if (recErr) toast.error(`Rental saved, but the proof wasn't: ${friendlyDbError(recErr)}`);
        }
      }
      toast.success(
        `${MODES[mode].label} saved: ${car.plate_number || car.name}, ${customer.name}.`
      );
      onDone();
    } catch (err) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
      toast.error(friendlyDbError(err));
    } finally {
      setSaving(false);
    }
  }

  const ModeIcon = MODES[mode].icon;

  return (
    <Modal title={`${car.plate_number || ''} · ${car.name}`} onClose={onClose}>
      <div className="space-y-5">
        {/* What is happening */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(MODES).map(([m, info]) => {
            const Icon = info.icon;
            return (
              <button
                key={m}
                onClick={() => pickMode(m)}
                className={`rounded-xl border px-2 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  m === mode ? info.tone : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {info.label}
              </button>
            );
          })}
        </div>

        <Step n={1} title="Customer">
          <CustomerPicker value={customer} onChange={setCustomer} mode={mode} />
        </Step>

        <Step n={2} title="Dates">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Pick-up</label>
              <input
                type="date"
                value={pickup}
                onChange={(e) => {
                  setDatesTouched(true);
                  setDates([e.target.value, ret]);
                }}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">
                {mode === 'RETURNED' ? 'Came back' : 'Return'}
              </label>
              <input
                type="date"
                value={ret}
                min={pickup}
                onChange={(e) => {
                  setDatesTouched(true);
                  setDates([pickup, e.target.value]);
                }}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {DURATIONS.map(([label, n]) => (
              <button
                key={label}
                onClick={() => {
                  setDatesTouched(true);
                  setDates([pickup, plus(pickup, n)]);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs border ${
                  estimate.days === n
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Step>

        <Step n={3} title="Rent">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-400">
                {estimate.days > 0
                  ? `${formatMYR(car.price_per_day)} × ${estimate.days} day${estimate.days === 1 ? '' : 's'}${estimate.discountPct > 0 ? ` less ${estimate.discountPct}%` : ''} = ${formatMYR(estimate.total)}`
                  : 'Choose the dates'}
              </p>
              <input
                type="number"
                min="0"
                value={agreed === '' ? estimate.total || '' : agreed}
                onChange={(e) => setAgreed(e.target.value)}
                className="input-field text-lg font-semibold"
              />
            </div>
            {agreed !== '' && (
              <button onClick={() => setAgreed('')} className="btn-secondary text-xs mb-0.5">
                Use the price
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Change it if you agreed a different price (on WhatsApp, a regular...).
          </p>
        </Step>

        <Step n={4} title="Money received">
          <p className="text-xs text-slate-400 mb-1.5">Rent paid</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['full', `All ${formatMYR(total)}`],
              ['part', 'Part'],
              ['none', 'Not yet'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPaidChoice(k)}
                className={`rounded-xl border px-2 py-2 text-xs font-medium ${
                  paidChoice === k
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {paidChoice === 'part' && (
            <input
              type="number"
              min="0"
              value={paidPart}
              onChange={(e) => setPaidPart(e.target.value)}
              placeholder="Amount paid (RM)"
              className="input-field mt-2"
            />
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Deposit received (RM)</p>
              <input
                type="number"
                min="0"
                value={deposit === '' ? depositValue : deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Paid by</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['cash', 'Cash'],
                  ['bank_transfer', 'Transfer'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setMethod(k)}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-medium ${
                      method === k
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(paid > 0 || depositValue > 0) && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Paid on</p>
                <input
                  type="date"
                  value={paidOn || (pickup < today ? pickup : today)}
                  max={today}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className="input-field"
                />
              </div>
              {paid > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Receipt (optional)</p>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                    className="input-field !py-1.5 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {mode === 'RETURNED' && depositValue > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-400 mb-1.5">The deposit now</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['refunded', 'Refunded'],
                  ['credit', 'Kept as credit'],
                  ['held', 'Still holding'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    disabled={k === 'credit' && !customer?.id}
                    onClick={() => setDepositOutcome(k)}
                    className={`rounded-xl border px-2 py-2 text-xs font-medium disabled:opacity-30 ${
                      depositOutcome === k
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!customer?.id && (
                <p className="text-[11px] text-slate-500 mt-1">Credit needs a customer account.</p>
              )}
            </div>
          )}
        </Step>

        <Step n={5} title="Proof and notes (optional)">
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setProof([...(e.target.files || [])])}
            className="input-field !py-1.5 text-xs"
          />
          <p className="text-[11px] text-slate-500 mt-1 mb-2">
            WhatsApp chat screenshots or the signed agreement. They stay with the booking.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything to remember about this rental"
            className="input-field"
          />
        </Step>

        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-sm space-y-1">
          <Line label="Rent" value={formatMYR(total)} />
          <Line label="Paid" value={formatMYR(paid)} />
          {total - paid > 0 && (
            <Line label="Still to pay" value={formatMYR(total - paid)} cls="text-amber-300" />
          )}
          {depositValue > 0 && <Line label="Deposit" value={formatMYR(depositValue)} />}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="btn-primary w-full !py-4 text-base flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ModeIcon className="w-5 h-5" />}
          {saving ? 'Saving...' : `Save ${MODES[mode].label.toLowerCase()}`}
        </button>
      </div>
    </Modal>
  );
}

function Step({ n, title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <span className="inline-flex w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 items-center justify-center mr-1.5 text-[10px]">
          {n}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

function Line({ label, value, cls = 'text-white' }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}

/** An account, someone who rented before without one, or a new name and phone. */
function CustomerPicker({ value, onChange, mode }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  async function find(text) {
    setQ(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const [people, past] = await Promise.all([
      supabase
        .from('bubatrent_booking_profiles')
        .select('id, display_name, phone, is_verified')
        .or(ilikeAny(['display_name', 'phone', 'ic_number', 'username'], text))
        .limit(6),
      supabase
        .from('bubatrent_booking_bookings')
        .select('customer_name, customer_phone')
        .is('user_id', null)
        .or(ilikeAny(['customer_name', 'customer_phone'], text))
        .limit(20),
    ]);
    const seen = new Set();
    const walkIns = [];
    for (const b of past.data || []) {
      const key = normalizePhone(b.customer_phone || '') || b.customer_name;
      if (!key || seen.has(key) || !b.customer_name) continue;
      seen.add(key);
      walkIns.push({ name: b.customer_name, phone: b.customer_phone });
    }
    setResults([
      ...(people.data || []).map((p) => ({
        id: p.id,
        name: p.display_name,
        phone: p.phone,
        verified: p.is_verified,
      })),
      ...walkIns.slice(0, 6),
    ]);
    setSearching(false);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{value.name}</p>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <Phone className="w-3 h-3" /> {value.phone || 'no phone'}
            {value.id ? (
              value.verified ? (
                <span className="text-emerald-400">· verified account</span>
              ) : (
                <span className="text-amber-300">· account, not verified</span>
              )
            ) : (
              <span>· no account</span>
            )}
          </p>
          {mode === 'CONFIRMED' && !(value.id && value.verified) && (
            <p className="text-[11px] text-amber-300 mt-1">
              A new booking needs a verified account. Use On rent or Past rental, or verify them in
              Customers first.
            </p>
          )}
        </div>
        <button onClick={() => onChange(null)} className="btn-secondary text-xs shrink-0">
          Change
        </button>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="input-field"
          autoFocus
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (WhatsApp)"
          inputMode="tel"
          className="input-field"
        />
        <div className="flex gap-2">
          <button onClick={() => setAdding(false)} className="btn-secondary flex-1 text-sm">
            Back
          </button>
          <button
            onClick={() => {
              if (!name.trim() || phone.replace(/\D/g, '').length < 9) return;
              onChange({ name: name.trim(), phone: phone.trim() });
            }}
            disabled={!name.trim() || phone.replace(/\D/g, '').length < 9}
            className="btn-primary flex-1 text-sm"
          >
            Use this customer
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          No account needed. Their rentals are kept together by phone number in Customer History.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => find(e.target.value)}
            placeholder="Search name, phone or IC..."
            className="input-field !pl-10"
          />
        </div>
        <button
          onClick={() => {
            setAdding(true);
            if (/\d{6,}/.test(q.replace(/\D/g, ''))) setPhone(q);
            else setName(q);
          }}
          className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
        >
          <UserPlus className="w-4 h-4" /> New
        </button>
      </div>
      {searching && <p className="text-xs text-slate-500 mt-2">Searching...</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={r.id || `w${i}`}
              onClick={() => onChange(r)}
              className="w-full text-left rounded-lg bg-white/[0.03] hover:bg-white/[0.07] px-3 py-2 text-sm flex justify-between gap-2"
            >
              <span className="text-white truncate">{r.name}</span>
              <span className="text-xs text-slate-400 shrink-0">
                {r.phone} {r.id ? (r.verified ? '· account ✓' : '· account') : '· rented before'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── A rental in progress, or one with money to settle ───

function RentalPanel({ booking, onClose, onChanged }) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [returning, setReturning] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const due = rentDue(booking);
  const car = booking.bubatrent_booking_cars;
  const wa = waLink(booking.customer_phone);
  const toRefund =
    booking.status === 'RETURNED' &&
    !booking.user_id &&
    Number(booking.deposit_amount) > 0 &&
    !booking.deposit_credited_at &&
    !booking.deposit_on_hold;

  async function markRefunded() {
    setRefunding(true);
    const { error } = await supabase.rpc('bubatrent_admin_deposit_refunded', {
      p_booking_id: booking.id,
      p_note: null,
    });
    setRefunding(false);
    if (error) {
      toast.error(friendlyDbError(error));
      return;
    }
    toast.success('Deposit marked refunded.');
    onChanged();
  }

  return (
    <Modal
      title={`${car?.plate_number || ''} · ${booking.customer_name || 'Rental'}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm space-y-1">
          <Line
            label="Status"
            value={
              booking.status === 'PICKUP'
                ? 'On rent'
                : booking.status === 'RETURNED'
                  ? 'Returned'
                  : 'Booked'
            }
          />
          <Line
            label="Dates"
            value={`${formatDate(booking.pickup_date)} – ${formatDate(booking.actual_return_date || booking.return_date)}`}
          />
          <Line label="Rent" value={formatMYR(booking.total_price)} />
          <Line label="Paid" value={formatMYR(booking.rent_paid)} />
          {due > 0 && <Line label="Still to pay" value={formatMYR(due)} cls="text-amber-300" />}
          {Number(booking.deposit_amount) > 0 && (
            <Line
              label="Deposit"
              value={`${formatMYR(booking.deposit_amount)}${
                booking.deposit_credited_at
                  ? ' · settled'
                  : booking.deposit_on_hold
                    ? ' · on hold'
                    : booking.status === 'RETURNED'
                      ? ' · to refund'
                      : ' · held'
              }`}
            />
          )}
          {booking.customer_phone && (
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Phone</span>
              <span className="flex items-center gap-3">
                <a href={`tel:${booking.customer_phone}`} className="text-violet-300">
                  {booking.customer_phone}
                </a>
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="text-green-400">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {due > 0 && (
            <BigButton icon={Banknote} tone="emerald" onClick={() => setPaying(true)}>
              Add payment
            </BigButton>
          )}
          {booking.status === 'PICKUP' && (
            <BigButton icon={CheckCircle2} tone="sky" onClick={() => setReturning(true)}>
              Mark returned
            </BigButton>
          )}
          {toRefund && (
            <BigButton icon={Wallet} tone="sky" onClick={markRefunded} disabled={refunding}>
              {refunding ? 'Saving...' : `Deposit ${formatMYR(booking.deposit_amount)} refunded`}
            </BigButton>
          )}
          <Link
            to={`/admin/bookings/${booking.id}`}
            className="rounded-2xl border border-white/10 p-4 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Open the booking
          </Link>
        </div>

        {['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'].includes(booking.status) && (
          <RentalChangesCard booking={booking} onChanged={onChanged} />
        )}
      </div>

      {paying && (
        <PaymentDialog
          booking={booking}
          onClose={() => setPaying(false)}
          onDone={() => {
            setPaying(false);
            onChanged();
          }}
        />
      )}
      {returning && (
        <ReturnCarDialog
          booking={booking}
          onClose={() => setReturning(false)}
          onDone={() => {
            setReturning(false);
            onChanged();
          }}
        />
      )}
    </Modal>
  );
}

function BigButton({ icon: Icon, tone, onClick, disabled, children }) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border p-4 text-sm font-medium flex items-center gap-2 hover:brightness-125 active:scale-[0.98] transition-all disabled:opacity-50 ${tones[tone]}`}
    >
      <Icon className="w-5 h-5" /> {children}
    </button>
  );
}

function PaymentDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const due = rentDue(booking);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState('cash');
  const [paidOn, setPaidOn] = useState(getTodayString());
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    let path = null;
    try {
      if (receipt) {
        path = `receipts/${booking.id}/rent_${Date.now()}.${receipt.name.split('.').pop()}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, path, receipt, toast);
        if (upErr) throw upErr;
      }
      const { error } = await supabase.rpc('bubatrent_admin_record_rent_payment', {
        p_booking_id: booking.id,
        p_amount: Number(amount),
        p_method: method,
        p_paid_on: paidOn || null,
        p_receipt_path: path,
      });
      if (error) throw error;
      toast.success(`${formatMYR(amount)} recorded.`);
      onDone();
    } catch (err) {
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      toast.error(friendlyDbError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add payment" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          {formatMYR(due)} rent still to pay for {booking.customer_name || 'this rental'}.
        </p>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input-field text-lg font-semibold"
        />
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
            <p className="text-xs text-slate-400 mb-1">Receipt (optional)</p>
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
          disabled={saving || !(Number(amount) > 0)}
          className="btn-primary w-full !py-3.5 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
          {saving ? 'Saving...' : `Record ${formatMYR(Number(amount) || 0)}`}
        </button>
      </div>
    </Modal>
  );
}
