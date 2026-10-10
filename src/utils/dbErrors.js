/**
 * Turn database errors into messages an admin or customer can act on.
 */
export function friendlyDbError(err) {
  // exclusion_violation from bubatrent_bookings_no_overlap
  if (err?.code === '23P01') {
    return 'Those dates overlap with another booking for this car. A customer checkout hold expires after 10 minutes.';
  }
  return err?.message || 'Something went wrong. Please try again.';
}
