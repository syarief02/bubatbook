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
