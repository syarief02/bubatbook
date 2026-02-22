export default function BookingStatusBadge({ status }) {
  const badgeMap = {
    HOLD: 'badge-hold',
    PAID: 'badge-paid',
    CONFIRMED: 'badge-confirmed',
    CANCELLED: 'badge-cancelled',
    EXPIRED: 'badge-expired',
  };

  return (
    <span className={badgeMap[status] || 'badge-expired'}>
      {status}
    </span>
  );
}
