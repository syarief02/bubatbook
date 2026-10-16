// A booking's rent as it stands (after an agreed price, an extension or an
// early return) and what was paid towards it; the changes made to the
// rental (bubatrent_booking_rental_changes).
import { formatDate } from './dates';
import { formatMYR } from './pricing';

/** Statuses in which a rental can be changed (price, dates, car). */
export const RENTAL_CHANGE_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED'];

/** The rental price now. */
export function rentalAmount(booking) {
  return Number(booking.total_price || 0);
}

/** Rent still to pay: the price less payments and workshop payments. */
export function rentDue(booking) {
  return Math.max(rentalAmount(booking) - Number(booking.rent_paid || 0), 0);
}

export function rentalChanges(booking) {
  return [...(booking?.bubatrent_booking_rental_changes || [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
}

function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

function carName(car) {
  if (!car) return 'another car';
  return car.plate_number ? `${car.name} (${car.plate_number})` : car.name;
}

/**
 * One change in words, e.g. "Extended to 12 Jun 2027 (+3 days)". `you`
 * words it for the customer.
 */
export function changeText(change, { you = false } = {}) {
  switch (change.kind) {
    case 'price':
      return `Agreed price${change.note ? `: ${change.note}` : ''}`;
    case 'extension': {
      const days = daysBetween(change.old_return, change.new_return);
      return `Extended to ${formatDate(change.new_return)} (+${days} day${days === 1 ? '' : 's'})`;
    }
    case 'early_return': {
      const days = daysBetween(change.new_return, change.old_return);
      const why =
        change.reason === 'breakdown'
          ? 'car broke down, no replacement'
          : Number(change.penalty) > 0
            ? `${formatMYR(change.penalty)} kept as the early-return penalty`
            : `ended early by ${you ? 'you' : 'the customer'}`;
      return `Ended early on ${formatDate(change.new_return)}: ${days} day${days === 1 ? '' : 's'} unused (${why})`;
    }
    case 'car_change':
      return `Car replaced from ${formatDate(change.change_date)}: ${carName(change.to_car)} instead of ${carName(change.from_car)}`;
    default:
      return change.kind;
  }
}

/** The select for a booking's changes, with the cars' names. */
export const RENTAL_CHANGES_SELECT =
  'bubatrent_booking_rental_changes(*, from_car:bubatrent_booking_cars!from_car_id(name, plate_number), to_car:bubatrent_booking_cars!to_car_id(name, plate_number))';
