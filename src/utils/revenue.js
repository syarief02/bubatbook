// Money figures for the admin Dashboard and Sales pages, from bookings.
// Rent is income. A deposit is the customer's money: held during the rental,
// then returned to their credit balance, so it is never counted as revenue.

// Bookings that took a car (cancelled and expired ones are left out)
export const BOOKED_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED'];

const HOLDING_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'];

/**
 * Rent received and kept: payments and workshop payments towards the rental,
 * less anything given back when the rental was shortened or made cheaper.
 */
export function rentalPaid(b) {
  return Number(b.rent_paid || 0);
}

function dayNumber(date) {
  return Math.round(Date.parse(date) / 86400000);
}

/**
 * Which cars a booking used and for what share of its days, when its car was
 * replaced (rental changes of kind car_change); otherwise its one car.
 */
export function rentShares(b) {
  const swaps = (b.bubatrent_booking_rental_changes || [])
    .filter((c) => c.kind === 'car_change')
    .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
  const start = dayNumber(b.pickup_date);
  const end = dayNumber(b.return_date);
  if (!swaps.length || end <= start) return [{ carId: b.car_id, share: 1 }];
  const shares = [];
  let car = swaps[0].from_car_id;
  let from = start;
  for (const swap of swaps) {
    const to = Math.min(Math.max(dayNumber(swap.change_date), from), end);
    shares.push({ carId: car, share: (to - from) / (end - start) });
    car = swap.to_car_id;
    from = to;
  }
  shares.push({ carId: car, share: (end - from) / (end - start) });
  return shares.filter((s) => s.share > 0);
}

/** The part of a booking's rent earned by one car. */
export function rentalPaidForCar(b, carId) {
  return rentShares(b)
    .filter((s) => s.carId === carId)
    .reduce((sum, s) => sum + rentalPaid(b) * s.share, 0);
}

/**
 * Deposit money that came in (verified), whether still held or already
 * returned. The part paid with the customer's credit is left out: it is
 * money that was already counted when it first came in.
 */
export function depositReceived(b) {
  return b.deposit_status === 'verified'
    ? Math.max(Number(b.deposit_amount || 0) - Number(b.credit_applied || 0), 0)
    : 0;
}

/**
 * Deposit held right now: verified and not yet returned, while the booking is
 * running or after the return while it is on hold for damage checks.
 */
export function depositHeld(b) {
  return (HOLDING_STATUSES.includes(b.status) || b.deposit_on_hold) &&
    b.deposit_status === 'verified' &&
    !b.deposit_credited_at
    ? Number(b.deposit_amount || 0)
    : 0;
}

/** Charges after the rental (late return, damage…) received so far: income. */
export function chargesCollected(b) {
  return Math.max(Number(b.charges_total || 0) - Number(b.amount_owed || 0), 0);
}

/** Charges the customer still owes. */
export function chargesOwed(b) {
  return Number(b.amount_owed || 0);
}

export function sumBy(rows, fn) {
  return rows.reduce((total, row) => total + fn(row), 0);
}

/** Expense claims paid out (completed). */
export function expensePaid(c) {
  return c.status === 'completed' ? Number(c.total_amount || 0) : 0;
}

/** Expense claims still waiting to be paid. */
export function expensePending(c) {
  return c.status === 'pending' ? Number(c.total_amount || 0) : 0;
}
