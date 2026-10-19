/**
 * Turn database errors into messages an admin or customer can act on.
 */
export function friendlyDbError(err) {
  // exclusion_violation from bubatrent_bookings_no_overlap
  if (err?.code === '23P01') {
    return 'Those dates overlap with another booking for this car. A customer checkout hold expires after 10 minutes.';
  }
  // check_violation on the bank details (the forms check them first)
  if (err?.code === '23514' && /bubatrent_profile_bank_/.test(err.message || '')) {
    return 'Please check the bank details: bank, account number (6 to 20 digits) and account holder name are all needed.';
  }
  return err?.message || 'Something went wrong. Please try again.';
}
