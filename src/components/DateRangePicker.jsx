import { CalendarDays } from 'lucide-react';
import { getTodayString, getTomorrowString } from '../utils/dates';
import { format, addDays, parseISO } from 'date-fns';

export default function DateRangePicker({ pickupDate, returnDate, onPickupChange, onReturnChange, className = '' }) {
  const today = getTodayString();

  // Return date must be at least 1 day after pickup (DB constraint: return_date > pickup_date)
  let minReturnDate = getTomorrowString();
  try {
    if (pickupDate && /^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
      minReturnDate = format(addDays(parseISO(pickupDate), 1), 'yyyy-MM-dd');
    }
  } catch {
    // Ignore parse errors from incomplete date strings
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      <div>
        <label className="input-label flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-violet-400" />
          Pick-up Date
        </label>
        <input
          type="date"
          value={pickupDate || ''}
          min={today}
          onChange={(e) => {
            onPickupChange(e.target.value);
            if (returnDate && e.target.value >= returnDate) {
              onReturnChange('');
            }
          }}
          className="input-field"
        />
      </div>
      <div>
        <label className="input-label flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-violet-400" />
          Return Date
        </label>
        <input
          type="date"
          value={returnDate || ''}
          min={minReturnDate}
          onChange={(e) => onReturnChange(e.target.value)}
          className="input-field"
          disabled={!pickupDate}
        />
      </div>
    </div>
  );
}
