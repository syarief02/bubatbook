import { useEffect, useState } from 'react';
import { ArrowLeftRight, CalendarMinus, CalendarPlus, Car, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { Modal } from './ReturnCharges';
import { useLongRentalRates } from '../hooks/useCars';
import { friendlyDbError } from '../utils/dbErrors';
import { formatDate, formatDateTime, getTodayString } from '../utils/dates';
import { calculatePrice, formatMYR } from '../utils/pricing';
import { changeText, rentalAmount, rentalChanges, rentDue } from '../utils/rent';

// Changing a rental after booking: an agreed price, a later or earlier return
// date, another car. The money moves happen in the database functions
// bubatrent_admin_change_rental_price / _extend_rental / _end_rental_early /
// _replace_car; each change is listed here and shown to the customer.

const round2 = (x) => Math.round(x * 100) / 100;

function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

function addDays(date, days) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

function Row({ label, value, strong, tone = 'text-white' }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`${tone} ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

function Buttons({ onClose, onSubmit, saving, label }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button onClick={onClose} className="btn-secondary flex-1">
        Cancel
      </button>
      <button onClick={onSubmit} disabled={saving} className="btn-primary flex-1">
        {saving ? 'Saving...' : label}
      </button>
    </div>
  );
}

/** What goes back to the customer, or is left to pay, once the price is `next`. */
function Settlement({ booking, next }) {
  const paid = Number(booking.rent_paid || 0);
  if (paid > next)
    return (
      <Row
        label="Back to the customer's credit"
        value={formatMYR(paid - next)}
        strong
        tone="text-green-400"
      />
    );
  return <Row label="Rent then left to pay" value={formatMYR(next - paid)} strong />;
}

function PriceDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const next = price === '' ? null : round2(Number(price));

  async function submit() {
    if (next === null || !(next >= 0)) return toast.error('Enter the new rental price.');
    if (!note.trim()) return toast.error('Give a reason for the new price.');
    setSaving(true);
    const { data, error } = await supabase.rpc('bubatrent_admin_change_rental_price', {
      p_booking_id: booking.id,
      p_new_total: next,
      p_note: note,
    });
    setSaving(false);
    if (error) return toast.error(friendlyDbError(error));
    toast.success(
      `Price changed to ${formatMYR(data.total)}.` +
        (Number(data.refund) > 0
          ? data.refund_by_hand
            ? ` Refund ${formatMYR(data.refund)} to the customer by hand (no account).`
            : ` ${formatMYR(data.refund)} went to the customer's credit.`
          : Number(data.rent_due) > 0
            ? ` ${formatMYR(data.rent_due)} to pay.`
            : '')
    );
    onDone();
  }

  return (
    <Modal title="Change the rental price" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">
          For a price agreed with the customer, or a correction. The invoice shows the change and
          the reason.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">New rental price (RM)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={String(rentalAmount(booking))}
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Reason</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. regular customer, agreed on WhatsApp"
              className="input-field !py-1.5 text-sm"
              maxLength={300}
            />
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 space-y-1">
          <Row label="Price now" value={formatMYR(rentalAmount(booking))} />
          <Row label="Rent paid so far" value={formatMYR(booking.rent_paid || 0)} />
          {next !== null && next >= 0 && (
            <>
              <Row
                label="Change"
                value={`${next >= rentalAmount(booking) ? '+' : '−'}${formatMYR(Math.abs(next - rentalAmount(booking)))}`}
              />
              <Settlement booking={booking} next={next} />
            </>
          )}
        </div>
        <Buttons onClose={onClose} onSubmit={submit} saving={saving} label="Change Price" />
      </div>
    </Modal>
  );
}

function ExtendDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const car = booking.bubatrent_booking_cars;
  const rates = useLongRentalRates(booking.fleet_group_id);
  const [newReturn, setNewReturn] = useState(addDays(booking.return_date, 1));
  const [agreed, setAgreed] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = newReturn > booking.return_date;
  // The rental at the rate for its new length, less what it was at the old one
  const standard = valid
    ? Math.max(
        calculatePrice(car?.price_per_day || 0, booking.pickup_date, newReturn, rates).total -
          calculatePrice(car?.price_per_day || 0, booking.pickup_date, booking.return_date, rates)
            .total,
        0
      )
    : 0;
  const custom = agreed !== '' && round2(Number(agreed)) !== round2(standard);
  const extra = custom ? round2(Number(agreed)) : round2(standard);

  async function submit() {
    if (!valid) return toast.error(`Choose a date after ${formatDate(booking.return_date)}.`);
    if (custom && (!(extra >= 0) || !note.trim()))
      return toast.error('Give a reason for the agreed extra rent.');
    setSaving(true);
    const { data, error } = await supabase.rpc('bubatrent_admin_extend_rental', {
      p_booking_id: booking.id,
      p_new_return: newReturn,
      p_extra: custom ? extra : null,
      p_note: note.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(friendlyDbError(error));
    toast.success(
      `Extended to ${formatDate(newReturn)}. ${formatMYR(data.extra)} extra rent` +
        (Number(data.rent_due) > 0 ? `; ${formatMYR(data.rent_due)} to pay.` : '.')
    );
    onDone();
  }

  return (
    <Modal title="Extend the rental" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">
          Keeps the car until the new date, if nobody has booked it. The extra days are blocked for
          other bookings.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">New return date</label>
            <input
              type="date"
              value={newReturn}
              min={addDays(booking.return_date, 1)}
              onChange={(e) => setNewReturn(e.target.value)}
              className="input-field !py-1.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Booked return: {formatDate(booking.return_date)}
            </p>
          </div>
          <div>
            <label className="input-label">Agreed extra rent (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={agreed}
              onChange={(e) => setAgreed(e.target.value)}
              placeholder={String(round2(standard))}
              className="input-field !py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="input-label">
            Note{custom ? ' (reason for the agreed amount)' : ''}
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. customer asked on WhatsApp"
            className="input-field !py-1.5 text-sm"
            maxLength={300}
          />
        </div>
        {valid && (
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-1">
            <Row
              label="Extra days"
              value={`${daysBetween(booking.return_date, newReturn)} (to ${formatDate(newReturn)})`}
            />
            <Row
              label={custom ? 'Agreed extra rent' : 'Extra rent at the rate for the new length'}
              value={formatMYR(extra)}
              strong
            />
            <Settlement booking={booking} next={rentalAmount(booking) + extra} />
            <p className="text-xs text-slate-500 pt-1">
              Record the payment under Full Payment when the customer pays.
            </p>
          </div>
        )}
        <Buttons onClose={onClose} onSubmit={submit} saving={saving} label="Extend Rental" />
      </div>
    </Modal>
  );
}

function EndEarlyDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const today = getTodayString();
  const latest = addDays(booking.return_date, -1);
  const earliest = addDays(booking.car_since || booking.pickup_date, booking.car_since ? 0 : 1);
  const start =
    booking.status === 'RETURNED' && booking.actual_return_date
      ? booking.actual_return_date
      : today;
  const [newReturn, setNewReturn] = useState(
    start < earliest ? earliest : start > latest ? latest : start
  );
  const [reason, setReason] = useState('customer');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // As bubatrent_admin_end_rental_early: the unused days at what this rental
  // cost per day; the customer's choice pays the agreement's 25% penalty
  const total = rentalAmount(booking);
  const booked = daysBetween(booking.pickup_date, booking.return_date);
  const unused = daysBetween(newReturn, booking.return_date);
  const valid = newReturn >= earliest && newReturn <= latest;
  const unusedRent = valid ? round2((total * unused) / booked) : 0;
  const penalty = reason === 'customer' ? round2(total * 0.25) : 0;
  const standard = Math.max(round2(unusedRent - penalty), 0);
  const changed = custom !== '' && round2(Number(custom)) !== standard;
  const reduction = changed ? round2(Number(custom)) : standard;

  async function submit() {
    if (!valid)
      return toast.error(`Choose a date from ${formatDate(earliest)} to ${formatDate(latest)}.`);
    if (changed && (!(reduction >= 0 && reduction <= unusedRent) || !note.trim()))
      return toast.error(
        `The amount taken off can be RM0 to ${formatMYR(unusedRent)}, with a reason.`
      );
    setSaving(true);
    const { data, error } = await supabase.rpc('bubatrent_admin_end_rental_early', {
      p_booking_id: booking.id,
      p_new_return: newReturn,
      p_reason: reason,
      p_reduction: changed ? reduction : null,
      p_note: note.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(friendlyDbError(error));
    toast.success(
      `Rental now ends ${formatDate(newReturn)}; ${formatMYR(data.reduction)} off the rental.` +
        (Number(data.refund) > 0
          ? data.refund_by_hand
            ? ` Refund ${formatMYR(data.refund)} to the customer by hand (no account).`
            : ` ${formatMYR(data.refund)} went to the customer's credit.`
          : '') +
        (booking.status === 'PICKUP' ? ' Use Mark Returned when the car is back.' : '')
    );
    onDone();
  }

  return (
    <Modal title="End the rental early" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">Last day (new return date)</label>
            <input
              type="date"
              value={newReturn}
              min={earliest}
              max={latest}
              onChange={(e) => setNewReturn(e.target.value)}
              className="input-field !py-1.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Booked return: {formatDate(booking.return_date)}
            </p>
          </div>
          <div>
            <p className="input-label">Why</p>
            <label className="flex items-start gap-2 text-slate-300 cursor-pointer mb-1">
              <input
                type="radio"
                checked={reason === 'customer'}
                onChange={() => setReason('customer')}
                className="mt-1"
              />
              <span>
                Customer&apos;s choice
                <span className="block text-xs text-slate-500">
                  25% penalty on the rental (agreement)
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
              <input
                type="radio"
                checked={reason === 'breakdown'}
                onChange={() => setReason('breakdown')}
                className="mt-1"
              />
              <span>
                Car broke down, no replacement
                <span className="block text-xs text-slate-500">No penalty</span>
              </span>
            </label>
          </div>
        </div>
        {valid && (
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-1">
            <Row label={`Unused days (${unused} of ${booked})`} value={formatMYR(unusedRent)} />
            {penalty > 0 && (
              <Row label="Penalty, 25% of the rental" value={`−${formatMYR(penalty)}`} />
            )}
            <Row
              label={changed ? 'Taken off the rental (changed)' : 'Taken off the rental'}
              value={formatMYR(reduction)}
              strong
            />
            <Row label="New rental price" value={formatMYR(total - reduction)} />
            <Settlement booking={booking} next={total - reduction} />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">Different amount off (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={String(standard)}
              className="input-field !py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="input-label">Note{changed ? ' (reason, required)' : ''}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. goodwill, regular customer"
              className="input-field !py-1.5 text-sm"
              maxLength={300}
            />
          </div>
        </div>
        {booking.status === 'PICKUP' && (
          <p className="text-xs text-slate-500">
            This changes the dates and the price. When the car is back, press Mark Returned as usual
            for the deposit and any charges.
          </p>
        )}
        <Buttons onClose={onClose} onSubmit={submit} saving={saving} label="End Early" />
      </div>
    </Modal>
  );
}

function ReplaceCarDialog({ booking, onClose, onDone }) {
  const toast = useToast();
  const current = booking.bubatrent_booking_cars;
  const pickedUp = booking.status === 'PICKUP';
  const earliest = booking.car_since || booking.pickup_date;
  const today = getTodayString();
  const [cars, setCars] = useState([]);
  const [carId, setCarId] = useState('');
  const [from, setFrom] = useState(
    today < earliest ? earliest : today > booking.return_date ? booking.return_date : today
  );
  const [oldUnavailable, setOldUnavailable] = useState(pickedUp);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('bubatrent_booking_cars')
      .select('id, name, plate_number, price_per_day')
      .eq('fleet_group_id', booking.fleet_group_id)
      .eq('is_available', true)
      .neq('id', booking.car_id)
      .order('name')
      .then(({ data }) => setCars(data || []));
  }, [booking.fleet_group_id, booking.car_id]);

  async function submit() {
    if (!carId) return toast.error('Choose the replacement car.');
    setSaving(true);
    const { error } = await supabase.rpc('bubatrent_admin_replace_car', {
      p_booking_id: booking.id,
      p_car_id: carId,
      p_from: pickedUp ? from : null,
      p_note: note.trim() || null,
      p_old_car_unavailable: oldUnavailable,
    });
    setSaving(false);
    if (error) return toast.error(friendlyDbError(error));
    toast.success(
      pickedUp ? `Car replaced from ${formatDate(from)}.` : 'The booking is now on the new car.'
    );
    onDone();
  }

  return (
    <Modal title="Replace the car" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">
          {pickedUp
            ? 'The rental continues on another car of this fleet at the same price. The old car is free again from that day.'
            : 'Moves the whole booking to another car of this fleet, at the same price.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="input-label">Replacement car</label>
            <select
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
              className="input-field !py-1.5 text-sm"
            >
              <option value="">Choose a car…</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.plate_number ? `(${c.plate_number})` : ''}
                </option>
              ))}
            </select>
          </div>
          {pickedUp && (
            <div>
              <label className="input-label">From</label>
              <input
                type="date"
                value={from}
                min={earliest}
                max={booking.return_date}
                onChange={(e) => setFrom(e.target.value)}
                className="input-field !py-1.5 text-sm"
              />
            </div>
          )}
        </div>
        <div>
          <label className="input-label">Reason (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. breakdown: radiator leak"
            className="input-field !py-1.5 text-sm"
            maxLength={300}
          />
        </div>
        <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={oldUnavailable}
            onChange={(e) => setOldUnavailable(e.target.checked)}
            className="mt-1"
          />
          <span>
            Mark {current?.name || 'the old car'}
            {current?.plate_number ? ` (${current.plate_number})` : ''} unavailable
            <span className="block text-xs text-slate-500">
              It can&apos;t be booked until you make it available again in Cars (e.g. while it is in
              the workshop).
            </span>
          </span>
        </label>
        <Buttons onClose={onClose} onSubmit={submit} saving={saving} label="Replace Car" />
      </div>
    </Modal>
  );
}

const ACTIONS = [
  {
    key: 'price',
    label: 'Change price',
    icon: Tag,
    statuses: ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED'],
  },
  { key: 'extend', label: 'Extend', icon: CalendarPlus, statuses: ['CONFIRMED', 'PICKUP'] },
  {
    key: 'early',
    label: 'End early',
    icon: CalendarMinus,
    statuses: ['CONFIRMED', 'PICKUP', 'RETURNED'],
  },
  { key: 'car', label: 'Replace car', icon: Car, statuses: ['CONFIRMED', 'PICKUP'] },
];
const DIALOGS = {
  price: PriceDialog,
  extend: ExtendDialog,
  early: EndEarlyDialog,
  car: ReplaceCarDialog,
};

/** The booking page card: what changed, and the buttons to change it. */
export function RentalChangesCard({ booking, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const changes = rentalChanges(booking);
  const actions = ACTIONS.filter((a) => a.statuses.includes(booking.status));
  const Dialog = dialog ? DIALOGS[dialog] : null;

  return (
    <div className="glass-card">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4" /> Change Rental
      </h3>

      {changes.length === 0 ? (
        <p className="text-sm text-slate-500">
          No changes. Agree a different price, extend, end early or replace the car here.
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {changes.map((c) => (
            <div key={c.id} className="py-2 first:pt-0 text-sm flex justify-between gap-3">
              <div>
                <p className="text-white">{changeText(c)}</p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(c.created_at)}
                  {c.note && c.kind !== 'price' ? ` · ${c.note}` : ''}
                </p>
              </div>
              {Number(c.amount) !== 0 && (
                <p
                  className={`shrink-0 font-medium ${Number(c.amount) < 0 ? 'text-green-400' : 'text-white'}`}
                >
                  {Number(c.amount) > 0 ? '+' : '−'}
                  {formatMYR(Math.abs(Number(c.amount)))}
                </p>
              )}
            </div>
          ))}
          <div className="pt-2 flex justify-between text-sm">
            <span className="text-slate-400">Rental price now</span>
            <span className="text-white font-semibold">{formatMYR(rentalAmount(booking))}</span>
          </div>
          {rentDue(booking) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Rent left to pay</span>
              <span className="text-amber-300 font-semibold">{formatMYR(rentDue(booking))}</span>
            </div>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setDialog(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {Dialog && (
        <Dialog
          booking={booking}
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
