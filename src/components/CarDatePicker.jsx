import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { getTodayString } from '../utils/dates';
import { useCarBookedDays } from '../hooks/useCars';

// The car page's pick-up and return dates, on a calendar that greys out the
// days the car is booked, so customers can see which dates are free.
// Same rule as the booking check: a booking takes every day from its
// pick-up to its return, both included, and a rental needs at least one
// night, so a free day just before a booked one can't be a pick-up day.

const DAY = 'yyyy-MM-dd';
// Bookings must end within 6 months (the booking functions refuse later returns)
const MONTHS_AHEAD = 6;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const nextDay = (d) => format(addDays(parseISO(d), 1), DAY);

/** The first booked day on or after `d`, or null. */
function firstBookedFrom(ranges, d) {
  let first = null;
  for (const r of ranges) {
    if (r.to_date < d) continue;
    const start = r.from_date > d ? r.from_date : d;
    if (first === null || start < first) first = start;
  }
  return first;
}

function DateField({ label, value, active, disabled, onClick }) {
  return (
    <div>
      <label className="input-label flex items-center gap-1.5">
        <CalendarDays className="w-4 h-4 text-violet-400" />
        {label}
      </label>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`input-field text-left text-sm ${active ? '!border-violet-400/60' : ''} ${value ? '' : 'text-slate-500'}`}
      >
        {value ? format(parseISO(value), 'EEE, d MMM yyyy') : 'Select date'}
      </button>
    </div>
  );
}

export default function CarDatePicker({
  carId,
  pickupDate,
  returnDate,
  onPickupChange,
  onReturnChange,
  className = '',
}) {
  const today = getTodayString();
  const { ranges, loading } = useCarBookedDays(carId);
  // Which date the next tap sets
  const [editing, setEditing] = useState(pickupDate && !returnDate ? 'return' : 'pickup');
  const [open, setOpen] = useState(!(pickupDate && returnDate));
  const [month, setMonth] = useState((pickupDate || today).slice(0, 7));

  const lastDay = format(addMonths(parseISO(today), MONTHS_AHEAD), DAY);
  const isBooked = (d) => ranges.some((r) => r.from_date <= d && r.to_date >= d);
  const canPickUp = (d) => d >= today && d < lastDay && !isBooked(d) && !isBooked(nextDay(d));
  const returnLimit = pickupDate ? firstBookedFrom(ranges, pickupDate) : null;
  const canReturn = (d) =>
    !!pickupDate && d > pickupDate && d <= lastDay && (returnLimit === null || d < returnLimit);
  // Dates picked earlier (or from a link) that run into a booking
  const clash =
    !!pickupDate &&
    !!returnDate &&
    ranges.some((r) => r.from_date <= returnDate && r.to_date >= pickupDate);
  const showCalendar = open || clash;

  function choose(d) {
    if (editing === 'return' && canReturn(d)) {
      onReturnChange(d);
      setEditing('pickup');
      setOpen(false);
      return;
    }
    if (canPickUp(d)) {
      onPickupChange(d);
      onReturnChange('');
      setEditing('return');
      setOpen(true);
    }
  }

  function openFor(which) {
    setEditing(which);
    setOpen(true);
    const shown = which === 'return' && returnDate ? returnDate : pickupDate;
    if (shown) setMonth(shown.slice(0, 7));
  }

  const monthStart = parseISO(`${month}-01`);
  const firstMonth = today.slice(0, 7);
  const lastMonth = lastDay.slice(0, 7);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart)),
  });

  function dayButton(date) {
    const d = format(date, DAY);
    if (d.slice(0, 7) !== month) return <div key={d} />;
    const booked = isBooked(d);
    const past = d < today;
    const isEnd = d === pickupDate || d === returnDate;
    const inRange = pickupDate && returnDate && d > pickupDate && d < returnDate;
    const enabled =
      editing === 'return' && pickupDate
        ? canReturn(d) || (d <= pickupDate && canPickUp(d))
        : canPickUp(d);
    let look;
    // A picked day that is booked (dates from a link) stays struck through, outlined
    if (isEnd && booked)
      look = 'bg-white/[0.06] text-slate-400 line-through ring-1 ring-inset ring-violet-400';
    else if (isEnd) look = 'bg-violet-500 text-white font-semibold';
    else if (booked) look = 'bg-white/[0.06] text-slate-600 line-through';
    else if (inRange) look = 'bg-violet-500/20 text-violet-100';
    else if (enabled) look = 'text-slate-100 hover:bg-white/10';
    else look = past ? 'text-slate-700' : 'text-slate-600';
    return (
      <button
        key={d}
        type="button"
        disabled={!enabled}
        onClick={() => choose(d)}
        aria-pressed={isEnd}
        aria-label={`${format(date, 'EEEE, d MMMM yyyy')}${booked ? ', booked' : ''}`}
        className={`h-10 rounded-lg text-sm transition-colors disabled:cursor-not-allowed ${look} ${d === today && !isEnd ? 'ring-1 ring-inset ring-violet-400/40' : ''}`}
      >
        {format(date, 'd')}
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Pick-up Date"
          value={pickupDate}
          active={showCalendar && editing === 'pickup'}
          onClick={() => openFor('pickup')}
        />
        <DateField
          label="Return Date"
          value={returnDate}
          active={showCalendar && editing === 'return'}
          disabled={!pickupDate}
          onClick={() => openFor('return')}
        />
      </div>

      {showCalendar && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400 mb-2">
            {editing === 'return' && pickupDate
              ? 'Now pick your return day.'
              : 'Pick your pick-up day. Greyed-out days are booked.'}
          </p>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMonth(format(addMonths(monthStart, -1), 'yyyy-MM'))}
              disabled={month <= firstMonth}
              aria-label="Previous month"
              className="p-2 rounded-lg text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-white">{format(monthStart, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setMonth(format(addMonths(monthStart, 1), 'yyyy-MM'))}
              disabled={month >= lastMonth}
              aria-label="Next month"
              className="p-2 rounded-lg text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <p key={w} className="text-[11px] font-medium text-slate-500 pb-1">
                {w}
              </p>
            ))}
            {days.map(dayButton)}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-white/[0.06] text-slate-600 line-through flex items-center justify-center text-[10px]">
                9
              </span>
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-violet-500" />
              Your dates
            </span>
            {loading && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking booked days…
              </span>
            )}
            {pickupDate && returnDate && !clash && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto text-violet-300 hover:text-white"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
