import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBookings, cancelBooking } from '../hooks/useBookings';
import { supabase } from '../lib/supabase';
import { uploadFileRobust } from '../lib/uploadHelper';
import { useToast } from '../components/Toast';
import { SignedLink } from '../components/SignedFile';
import BookingStatusBadge from '../components/BookingStatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatDate, formatDateTime } from '../utils/dates';
import { formatMYR } from '../utils/pricing';
import { chargeLabel } from '../utils/charges';
import {
  rentDue,
  rentalAmount,
  rentPaidToWorkshop,
  workshopPayments,
  workshopSplit,
} from '../utils/workshop';
import {
  CalendarDays,
  ExternalLink,
  Car,
  XCircle,
  Hash,
  Upload,
  FileImage,
  Loader2,
  FileSignature,
  Receipt,
} from 'lucide-react';

export default function MyBookings() {
  const { user } = useAuth();
  const toast = useToast();
  const { bookings, loading, error, refetch } = useBookings(user?.id);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);

  async function handleCancel(bookingId) {
    try {
      setCancellingId(bookingId);
      await cancelBooking(bookingId, user.id);
      setConfirmCancelId(null);
      await refetch();
    } catch (err) {
      toast.error('Failed to cancel: ' + err.message);
    } finally {
      setCancellingId(null);
    }
  }

  async function handleUploadFullPayment(bookingId) {
    if (!receiptFile) {
      toast.error('Select a receipt file first.');
      return;
    }
    setUploadingId(bookingId);
    try {
      const ext = receiptFile.name.split('.').pop();
      const path = `receipts/${bookingId}/full_payment_${Date.now()}.${ext}`;
      const { error: upErr } = await uploadFileRobust(
        'customer-documents',
        path,
        receiptFile,
        toast
      );
      if (upErr) throw upErr;
      const { error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({ full_payment_receipt_path: path, full_payment_status: 'uploaded' })
        .eq('id', bookingId);
      if (error) throw error;
      setReceiptFile(null);
      toast.success('Full payment receipt uploaded!');
      await refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  const canCancel = (status) => ['HOLD', 'DEPOSIT_PAID'].includes(status);

  return (
    <div className="page-container max-w-3xl mx-auto">
      <h1 className="section-title mb-8">My Bookings</h1>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="glass-card text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings yet"
          description="Browse our fleet and make your first booking!"
          action={
            <Link to="/" className="btn-primary inline-flex items-center gap-2">
              <Car className="w-4 h-4" /> Browse Cars
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, i) => {
            const car = booking.bubatrent_booking_cars;
            const showFullPaymentUpload =
              ['CONFIRMED', 'PICKUP'].includes(booking.status) &&
              !booking.full_payment_receipt_path &&
              booking.full_payment_status !== 'verified';
            const workshop = workshopPayments(booking);
            const paidToWorkshop = rentPaidToWorkshop(booking);
            const fullPaymentPending = booking.full_payment_status === 'uploaded';

            return (
              <div
                key={booking.id}
                className="glass-card glass-card-hover animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {car?.image_url && (
                    <img
                      src={car.image_url}
                      alt={car?.name}
                      className="w-full sm:w-32 h-24 rounded-xl object-cover shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-white font-semibold">{car?.name || 'Car'}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">
                            {car?.brand} {car?.model}
                          </p>
                          <span className="text-[10px] text-slate-600 font-mono flex items-center gap-0.5">
                            <Hash className="w-2.5 h-2.5" />
                            {booking.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                      <div>
                        <p className="text-slate-500">Pick-up</p>
                        <p className="text-slate-200">{formatDate(booking.pickup_date)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Return</p>
                        <p className="text-slate-200">{formatDate(booking.return_date)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Rental</p>
                        <p className="text-slate-200">{formatMYR(booking.total_price)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Deposit</p>
                        <p className="text-green-400">{formatMYR(booking.deposit_amount)}</p>
                      </div>
                    </div>

                    {booking.status === 'DEPOSIT_PAID' &&
                      booking.deposit_status !== 'verified' &&
                      booking.deposit_review_due_at && (
                        <p className="text-xs text-yellow-400 mb-3">
                          We&apos;re checking your deposit receipt. If it isn&apos;t verified by{' '}
                          {formatDateTime(booking.deposit_review_due_at)}, this booking is released
                          and the car becomes available to others.
                        </p>
                      )}
                    {booking.status === 'EXPIRED' && booking.deposit_receipt_path && (
                      <p className="text-xs text-slate-400 mb-3">
                        This booking was released because the deposit wasn&apos;t verified within 48
                        hours. Contact us if you&apos;ve already paid.
                      </p>
                    )}
                    {booking.deposit_status === 'verified' &&
                      ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'].includes(booking.status) &&
                      !booking.deposit_credited_at && (
                        <p className="text-xs text-slate-400 mb-3">
                          Your {formatMYR(booking.deposit_amount)} deposit is held during the rental
                          and goes to your credit balance after the car is returned.
                        </p>
                      )}
                    {booking.deposit_on_hold && (
                      <p className="text-xs text-yellow-400 mb-3">
                        Your deposit is on hold while we check the car. We&apos;ll release it to
                        your credit balance, less any charges, once that&apos;s done.
                      </p>
                    )}
                    {booking.deposit_credited_at &&
                      ['RETURNED', 'CANCELLED'].includes(booking.status) && (
                        <p className="text-xs text-green-400 mb-3">
                          ✓ Deposit returned to your credit balance on{' '}
                          {formatDate(booking.deposit_credited_at)}
                          {Number(booking.charges_total) > 0 && ', less the charges below'}
                        </p>
                      )}
                    {(booking.bubatrent_booking_charges || []).length > 0 && (
                      <div className="mb-3 rounded-xl bg-white/[0.03] p-3 text-xs space-y-1">
                        <p className="text-slate-400 font-medium">Charges after the rental</p>
                        {booking.bubatrent_booking_charges.map((c) => (
                          <div key={c.id} className="flex justify-between gap-3">
                            <span className="text-slate-300">
                              {chargeLabel(c.kind)}
                              {c.description && ` — ${c.description}`}
                            </span>
                            <span className="text-white shrink-0">{formatMYR(c.amount)}</span>
                          </div>
                        ))}
                        {Number(booking.amount_owed) > 0 ? (
                          <p className="text-red-400 pt-1">
                            The charges are more than your deposit. Please pay the remaining{' '}
                            {formatMYR(booking.amount_owed)} — contact us to arrange it.
                          </p>
                        ) : booking.bubatrent_booking_charges.every(
                            (c) => Number(c.from_deposit) >= Number(c.amount)
                          ) ? (
                          <p className="text-slate-500 pt-1">Taken from your deposit.</p>
                        ) : (
                          <p className="text-slate-500 pt-1">
                            Settled from your deposit and your payment. Thank you.
                          </p>
                        )}
                      </div>
                    )}
                    {workshop.length > 0 && (
                      <div className="mb-3 rounded-xl bg-white/[0.03] p-3 text-xs space-y-1">
                        <p className="text-slate-400 font-medium">Paid to the workshop for us</p>
                        {workshop.map((w) => (
                          <div key={w.id}>
                            <div className="flex justify-between gap-3">
                              <span className="text-slate-300">
                                {w.workshop} — {w.description}
                              </span>
                              <span className="text-white shrink-0">{formatMYR(w.amount)}</span>
                            </div>
                            <p className="text-slate-500">
                              {workshopSplit(w, { customer: 'your' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Full payment upload */}
                    {showFullPaymentUpload && (
                      <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-3 mb-3">
                        <p className="text-xs text-violet-300 mb-2">
                          Upload your full rental payment receipt ({formatMYR(rentDue(booking))})
                          {paidToWorkshop > 0 &&
                            ` — the ${formatMYR(rentalAmount(booking))} rental less ${formatMYR(paidToWorkshop)} you paid the workshop for us`}
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="relative flex items-center gap-2 text-xs text-slate-400 cursor-pointer bg-white/5 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-colors overflow-hidden">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={(e) => setReceiptFile(e.target.files[0])}
                            />
                            <FileImage className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[140px]">
                              {receiptFile ? receiptFile.name : 'Choose file'}
                            </span>
                          </label>
                          {receiptFile && (
                            <button
                              onClick={() => handleUploadFullPayment(booking.id)}
                              disabled={uploadingId === booking.id}
                              className="px-3 py-1.5 rounded-lg text-xs bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors flex items-center gap-1"
                            >
                              {uploadingId === booking.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3" /> Upload
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {fullPaymentPending && (
                      <p className="text-xs text-yellow-400 mb-3">
                        Full payment receipt submitted — awaiting verification
                      </p>
                    )}
                    {booking.full_payment_status === 'verified' && (
                      <p className="text-xs text-green-400 mb-3">✓ Full payment verified</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/booking/${booking.id}/confirmation`}
                        className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
                      >
                        View Details <ExternalLink className="w-3 h-3" />
                      </Link>

                      {['CONFIRMED', 'PICKUP', 'RETURNED'].includes(booking.status) && (
                        <Link
                          to={`/booking/${booking.id}/agreement`}
                          className="text-xs text-cyan-500/70 hover:text-cyan-400 flex items-center gap-1"
                        >
                          <FileSignature className="w-3 h-3" /> Agreement
                        </Link>
                      )}

                      {booking.deposit_receipt_path && (
                        <SignedLink
                          path={booking.deposit_receipt_path}
                          className="text-xs text-emerald-500/70 hover:text-emerald-400 flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" /> Deposit Receipt
                        </SignedLink>
                      )}

                      {booking.full_payment_receipt_path && (
                        <SignedLink
                          path={booking.full_payment_receipt_path}
                          className="text-xs text-emerald-500/70 hover:text-emerald-400 flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" /> Payment Receipt
                        </SignedLink>
                      )}

                      {(booking.deposit_status === 'verified' ||
                        booking.full_payment_status === 'verified') && (
                        <Link
                          to={`/booking/${booking.id}/invoice`}
                          className="text-xs text-violet-500/70 hover:text-violet-400 flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" /> Invoice
                        </Link>
                      )}

                      {canCancel(booking.status) && (
                        <>
                          {confirmCancelId === booking.id ? (
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-xs text-yellow-400">Cancel this booking?</span>
                              <button
                                onClick={() => handleCancel(booking.id)}
                                disabled={cancellingId === booking.id}
                                className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {cancellingId === booking.id ? 'Cancelling...' : 'Yes, Cancel'}
                              </button>
                              <button
                                onClick={() => setConfirmCancelId(null)}
                                className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmCancelId(booking.id)}
                              className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 ml-auto transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Cancel
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
