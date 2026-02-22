import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBooking, cancelBooking } from '../hooks/useBookings';
import LoadingSpinner from '../components/LoadingSpinner';
import BookingStatusBadge from '../components/BookingStatusBadge';
import { formatDate } from '../utils/dates';
import { formatMYR } from '../utils/pricing';
import { CheckCircle, FileUp, CalendarDays, Copy, ExternalLink, XCircle, AlertTriangle } from 'lucide-react';

export default function BookingConfirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  async function handleCancel() {
    try {
      setCancelling(true);
      const updated = await cancelBooking(id);
      setBooking((prev) => ({ ...prev, status: 'CANCELLED' }));
      setShowCancelConfirm(false);
    } catch (err) {
      alert('Failed to cancel booking: ' + err.message);
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
  const canCancel = ['HOLD', 'PAID', 'CONFIRMED'].includes(booking.status);
  const isCancelled = booking.status === 'CANCELLED';

  function copyBookingId() {
    navigator.clipboard.writeText(booking.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="text-center mb-8 animate-fade-in">
        {isCancelled ? (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Booking Cancelled</h1>
            <p className="text-slate-400">This booking has been cancelled.</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h1>
            <p className="text-slate-400">Your deposit has been received and your booking is secured.</p>
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
            <p className="text-xs text-slate-500 mb-1">Deposit Paid</p>
            <p className="text-green-400 font-semibold">{formatMYR(booking.deposit_amount)}</p>
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
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span>Payment Ref: {payment.reference_number}</span>
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
