// Repairs the customer paid the workshop for directly, taken off what they owe
// us (see bubatrent_admin_record_workshop_payment). Each one is split into
// the rental still to pay, charges owed, and the rest to their credit.
import { formatMYR } from './pricing';

/** Workshop payments can be recorded once the booking is confirmed. */
export const WORKSHOP_STATUSES = ['CONFIRMED', 'PICKUP', 'RETURNED'];

export function workshopPayments(booking) {
  return [...(booking?.bubatrent_booking_workshop_payments || [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
}

/** The full rental, before any workshop payments. */
export function rentalAmount(booking) {
  return Number(booking.full_payment_amount || booking.total_price || 0);
}

/** The part of the rental the customer paid by paying the workshop. */
export function rentPaidToWorkshop(booking) {
  return workshopPayments(booking).reduce((sum, w) => sum + Number(w.to_rent || 0), 0);
}

/** What the customer pays us for the rental, after workshop payments. */
export function rentDue(booking) {
  return Math.max(rentalAmount(booking) - rentPaidToWorkshop(booking), 0);
}

/** Where a workshop payment went, e.g. "RM 300 off the rental, RM 50 to the customer's credit". */
export function workshopSplit(w, { customer = "the customer's" } = {}) {
  const parts = [];
  if (Number(w.to_rent) > 0) parts.push(`${formatMYR(w.to_rent)} off the rental`);
  if (Number(w.to_charges) > 0) parts.push(`${formatMYR(w.to_charges)} off charges owed`);
  if (Number(w.to_credit) > 0) parts.push(`${formatMYR(w.to_credit)} to ${customer} credit`);
  return parts.join(', ');
}
