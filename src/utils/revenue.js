// Money figures for the admin Dashboard and Sales pages, from bookings.
// Rent is income. A deposit is the customer's money: held during the rental,
// then returned to their credit balance, so it is never counted as revenue.

// Bookings that took a car (cancelled and expired ones are left out)
export const BOOKED_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED'];

const HOLDING_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'];

/** Rent received: the verified full payment. */
export function rentalPaid(b) {
  return b.full_payment_status === 'verified'
    ? Number(b.full_payment_amount || b.total_price || 0)
    : 0;
}

/** Deposit received (verified), whether still held or already returned. */
export function depositReceived(b) {
  return b.deposit_status === 'verified' ? Number(b.deposit_amount || 0) : 0;
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
