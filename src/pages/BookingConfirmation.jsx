import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBooking, cancelBooking } from '../hooks/useBookings';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import BookingStatusBadge from '../components/BookingStatusBadge';
import { formatDate } from '../utils/dates';
import { formatMYR } from '../utils/pricing';
import { CheckCircle, FileUp, CalendarDays, Copy, ExternalLink, XCircle, AlertTriangle, Download, Clock, MessageCircle } from 'lucide-react';

export default function BookingConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [fleetGroup, setFleetGroup] = useState(null);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const data = await getBooking(id);
        setBooking(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, [id]);

  // Fetch fleet group for WhatsApp button
  useEffect(() => {
    if (!booking?.fleet_group_id) return;
    supabase
      .from('bubatrent_booking_fleet_groups')
      .select('name, support_whatsapp, support_phone')
      .eq('id', booking.fleet_group_id)
      .single()
      .then(({ data }) => setFleetGroup(data));
  }, [booking?.fleet_group_id]);

  async function handleCancel() {
    try {
      setCancelling(true);
      await cancelBooking(id, user?.id);
      setBooking((prev) => ({ ...prev, status: 'CANCELLED' }));
      setShowCancelConfirm(false);
      toast.success('Booking cancelled');
    } catch (err) {
      toast.error('Failed to cancel: ' + err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <LoadingSpinner fullScreen />;
  if (!booking) {
    return (
      <div className="page-container text-center">
        <p className="text-red-400">Booking not found.</p>
        <Link to="/" className="text-violet-400 hover:underline mt-4 inline-block">Back to home</Link>
      </div>
    );
  }

  const car = booking.bubatrent_booking_cars;
  const payment = booking.bubatrent_booking_payments?.[0];
  const canCancel = ['HOLD', 'DEPOSIT_PAID'].includes(booking.status);
  const isCancelled = booking.status === 'CANCELLED';
  const isExpired = booking.status === 'EXPIRED';
  const isHold = booking.status === 'HOLD';
  const hasPaid = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED'].includes(booking.status);

  function copyBookingId() {
    navigator.clipboard.writeText(booking.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadReceipt() {
    const creditApplied = Number(booking.credit_applied || 0);
    const fullPayment = Number(booking.full_payment_amount || booking.total_price || 0);
    const receiptHtml = `<!DOCTYPE html>
<html><head><title>Rent2Go Receipt - ${booking.id.slice(0, 8).toUpperCase()}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8f9fa; padding: 16px; }
  .receipt { width: 100%; max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.08); overflow: hidden; }
  .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 20px 16px; text-align: center; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header p { font-size: 12px; opacity: 0.8; }
  .body { padding: 16px; }
  .ref { text-align: center; margin-bottom: 16px; }
  .ref code { background: #f0f0f5; padding: 6px 14px; border-radius: 8px; font-size: 14px; font-weight: 600; color: #7c3aed; letter-spacing: 1px; display: inline-block; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 6px; font-weight: 600; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; gap: 8px; }
  .row .label { color: #666; white-space: nowrap; }
  .row .value { color: #111; font-weight: 500; text-align: right; word-break: break-all; }
  .divider { border-top: 1px dashed #e0e0e0; margin: 10px 0; }
  .total-row { font-size: 15px; font-weight: 700; }
  .total-row .value { color: #7c3aed; }
  .credit-row .value { color: #16a34a; }
  .footer { text-align: center; padding: 14px 16px 20px; font-size: 11px; color: #999; }
  .print-bar { text-align: center; margin-bottom: 12px; }
  .print-bar button { background: #7c3aed; color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; cursor: pointer; width: 100%; max-width: 300px; }
  @media (min-width: 480px) {
    body { padding: 20px; }
    .header { padding: 24px; }
    .body { padding: 24px; }
    .row { font-size: 14px; }
    .print-bar button { width: auto; }
  }
  @media print { .print-bar { display: none; } body { padding: 0; background: white; } .receipt { box-shadow: none; border-radius: 0; } }
</style></head><body>
<div class="print-bar"><button onclick="window.print()">🖨️ Print Receipt</button></div>
<div class="receipt">
  <div class="header">
    <h1>Rent2Go</h1>
    <p>Premium Car Rental Malaysia</p>
  </div>
  <div class="body">
    <div class="ref"><code>${booking.id.slice(0, 8).toUpperCase()}</code></div>
    <div class="row"><span class="label">Date Issued</span><span class="value">${new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <div class="row"><span class="label">Status</span><span class="value">${booking.status}</span></div>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">Vehicle</div>
      <div class="row"><span class="label">Car</span><span class="value">${car?.name || 'N/A'}</span></div>
      <div class="row"><span class="label">Brand / Model</span><span class="value">${car?.brand || ''} ${car?.model || ''}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Rental Period</div>
      <div class="row"><span class="label">Pick-up</span><span class="value">${formatDate(booking.pickup_date)}</span></div>
      <div class="row"><span class="label">Return</span><span class="value">${formatDate(booking.return_date)}</span></div>
    </div>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">Payment</div>
      <div class="row"><span class="label">Rental Total</span><span class="value">${formatMYR(booking.total_price)}</span></div>
      <div class="row"><span class="label">Deposit</span><span class="value">${formatMYR(booking.deposit_amount)}</span></div>
      ${creditApplied > 0 ? `<div class="row credit-row"><span class="label">Credit Applied</span><span class="value">-${formatMYR(creditApplied)}</span></div>` : ''}
      <div class="row"><span class="label">Full Payment</span><span class="value">${formatMYR(fullPayment)}</span></div>
      ${payment ? `<div class="row"><span class="label">Payment Ref</span><span class="value">${payment.reference_number}</span></div>` : ''}
    </div>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">Customer</div>
      <div class="row"><span class="label">Name</span><span class="value">${booking.customer_name || 'N/A'}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${booking.customer_email || 'N/A'}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${booking.customer_phone || 'N/A'}</span></div>
    </div>
  </div>
  <div class="footer">
    Thank you for choosing Rent2Go!<br/>
    For support: bubatresources@gmail.com · +60 16-256 9733
  </div>
</div>
</body></html>`;
    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    toast.success('Receipt opened — you can print it!');
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="text-center mb-8 animate-fade-in">
        {isCancelled || isExpired ? (
          <>
            <div className={`w-20 h-20 rounded-full ${isExpired ? 'bg-slate-500/10' : 'bg-red-500/10'} flex items-center justify-center mx-auto mb-4`}>
              {isExpired ? <Clock className="w-10 h-10 text-slate-400" /> : <XCircle className="w-10 h-10 text-red-400" />}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {isExpired ? 'Booking Expired' : 'Booking Cancelled'}
            </h1>
            <p className="text-slate-400">
              {isExpired
                ? 'This booking has expired. The hold time ran out before payment was received.'
                : 'This booking has been cancelled.'}
            </p>
          </>
        ) : isHold ? (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Booking on Hold</h1>
            <p className="text-slate-400">Please upload your deposit receipt to secure this booking. Hold expires in 10 minutes.</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {booking.status === 'DEPOSIT_PAID' ? 'Deposit Received!' : 'Booking Confirmed!'}
            </h1>
            <p className="text-slate-400">
              {booking.status === 'DEPOSIT_PAID'
                ? 'Your deposit has been uploaded. Awaiting admin verification.'
                : 'Your booking is secured and confirmed.'}
            </p>
          </>
        )}
      </div>

      <div className="glass-card mb-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Booking Reference</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-violet-300 bg-violet-500/10 px-3 py-1 rounded-lg">
                {booking.id.slice(0, 8).toUpperCase()}
              </code>
              <button onClick={copyBookingId} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-slate-500 hover:text-white">
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        {/* Car info */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
          {car?.image_url && (
            <img src={car.image_url} alt={car.name} className="w-20 h-14 rounded-xl object-cover" />
          )}
          <div>
            <h3 className="text-white font-semibold">{car?.name || 'Car'}</h3>
            <p className="text-xs text-slate-500">{car?.brand} {car?.model}</p>
          </div>
        </div>

        {/* Dates & pricing */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Pick-up</p>
            <p className="text-white">{formatDate(booking.pickup_date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Return</p>
            <p className="text-white">{formatDate(booking.return_date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Price</p>
            <p className="text-white font-semibold">{formatMYR(booking.total_price)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">{isHold ? 'Deposit Required' : 'Deposit Paid'}</p>
            <p className={`font-semibold ${isHold ? 'text-yellow-400' : 'text-green-400'}`}>{formatMYR(booking.deposit_amount)}</p>
          </div>
        </div>

        {/* Customer info */}
        <div className="bg-white/[0.02] rounded-xl p-4 text-sm">
          <p className="text-xs text-slate-500 mb-2">Customer Details</p>
          <p className="text-white">{booking.customer_name}</p>
          <p className="text-slate-400">{booking.customer_email}</p>
          <p className="text-slate-400">{booking.customer_phone}</p>
        </div>

        {payment && (
          <p className="mt-4 text-xs text-slate-500">Payment Ref: {payment.reference_number}</p>
        )}

        {/* WhatsApp Payment Button */}
        {fleetGroup?.support_whatsapp && !isCancelled && !isExpired && (
          <a
            href={`https://wa.me/${fleetGroup.support_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hi, I'd like to make payment for my booking:\n\n` +
              `📋 Booking ID: ${booking.id.slice(0, 8).toUpperCase()}\n` +
              `👤 Name: ${booking.customer_name || 'N/A'}\n` +
              `🚗 Car: ${car?.name || car?.brand + ' ' + car?.model}\n` +
              `📅 Dates: ${booking.pickup_date} → ${booking.return_date}\n` +
              `💰 ${isHold ? 'Deposit Due' : 'Amount'}: RM${isHold ? booking.deposit_amount : booking.total_price}\n\n` +
              `I will upload my receipt after payment. Thank you!`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-3 rounded-xl text-sm font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Contact {fleetGroup.name} for Payment (WhatsApp)
          </a>
        )}

        {Number(booking.credit_applied || 0) > 0 && (
          <p className="mt-2 text-xs text-green-400">Credit applied: {formatMYR(booking.credit_applied)}</p>
        )}

        {hasPaid && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={downloadReceipt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        )}

        {/* Cancel Booking Button */}
        {canCancel && !showCancelConfirm && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Cancel Booking
            </button>
          </div>
        )}

        {/* Cancel Confirmation */}
        {showCancelConfirm && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="glass-card !bg-red-500/5 border-red-500/20">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium mb-1">Are you sure you want to cancel?</p>
                  <p className="text-xs text-slate-400">This action cannot be undone. Your booking will be released and the dates will become available for others.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors text-sm"
                >
                  Keep Booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Steps — only show if not cancelled */}
      {!isCancelled && (
        <div className="glass-card animate-slide-up" style={{ animationDelay: '150ms' }}>
          <h3 className="text-sm font-semibold text-white mb-4">Next Steps</h3>
          <div className="space-y-3">
            <Link
              to={`/booking/${booking.id}/documents`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <FileUp className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium group-hover:text-violet-300 transition-colors">Upload Identity Documents</p>
                <p className="text-xs text-slate-500">Submit your driving licence for verification (recommended)</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
            </Link>

            <Link
              to="/my-bookings"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium group-hover:text-indigo-300 transition-colors">View My Bookings</p>
                <p className="text-xs text-slate-500">Track all your bookings in one place</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
            </Link>
          </div>
        </div>
      )}

      {/* Back to home for cancelled bookings */}
      {isCancelled && (
        <div className="text-center animate-slide-up" style={{ animationDelay: '150ms' }}>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Browse Cars
          </Link>
        </div>
      )}
    </div>
  );
}
