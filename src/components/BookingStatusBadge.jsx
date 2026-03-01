export default function BookingStatusBadge({ status }) {
  const badgeMap = {
    HOLD: 'badge-hold',
    DEPOSIT_PAID: 'badge-paid',
    PAID: 'badge-paid',
    CONFIRMED: 'badge-confirmed',
    PICKUP: 'badge-pickup',
    RETURNED: 'badge-returned',
    CANCELLED: 'badge-cancelled',
    EXPIRED: 'badge-expired',
  };

  const labelMap = {
    HOLD: 'Hold',
    DEPOSIT_PAID: 'Deposit Paid',
    PAID: 'Deposit Paid',
    CONFIRMED: 'Confirmed',
    PICKUP: 'Picked Up',
    RETURNED: 'Returned',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };

  return (
    <span className={badgeMap[status] || 'badge-expired'}>
      {labelMap[status] || status}
    </span>
  );
}
