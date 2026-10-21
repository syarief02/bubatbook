import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getBookingDocuments, verifyDocument, getAuditLogs } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { uploadFileRobust } from '../../lib/uploadHelper';
import { expireStaleHolds } from '../../hooks/useBookings';
import { friendlyDbError } from '../../utils/dbErrors';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateTime } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';
import { maskSensitive } from '../../utils/format';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  FileText,
  Shield,
  CheckCircle,
  Clock,
  Eye,
  FileCheck,
  Edit3,
  Save,
  X,
  FileImage,
  Wallet,
  Trash2,
  ClipboardCopy,
  FileSignature,
} from 'lucide-react';

import { SignedLink, SignedImage } from '../../components/SignedFile';
import { ChargesCard, ReturnCarDialog } from '../../components/ReturnCharges';
import { WorkshopPaymentsCard } from '../../components/WorkshopPayments';
import { RentalChangesCard } from '../../components/RentalChanges';
import { BookingRecordsCard } from '../../components/BookingRecords';
import { WORKSHOP_STATUSES, rentPaidToWorkshop, workshopPayments } from '../../utils/workshop';
import {
  RENTAL_CHANGES_SELECT,
  RENTAL_CHANGE_STATUSES,
  rentDue,
  rentalAmount,
  rentalChanges,
} from '../../utils/rent';
// Status flow definition
const STATUS_FLOW = {
  HOLD: ['DEPOSIT_PAID', 'CANCELLED'],
  DEPOSIT_PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKUP', 'CANCELLED'],
  PICKUP: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
  EXPIRED: ['DEPOSIT_PAID'],
};

const BOOKING_SELECT =
  '*, bubatrent_booking_cars(*), bubatrent_booking_payments(*), bubatrent_booking_charges(*), ' +
  'bubatrent_booking_workshop_payments(*, bubatrent_booking_expense_claims(bubatrent_booking_expense_images(file_path))), ' +
  RENTAL_CHANGES_SELECT;

// Audit log entries. Booking changes are logged by the database.
const AUDIT_LABELS = {
  CHARGE_ADDED: 'Charge added',
  CHARGE_REMOVED: 'Charge removed',
  CHARGE_PAYMENT: 'Payment received for charges',
  WORKSHOP_PAYMENT: 'Customer paid the workshop for us',
  WORKSHOP_PAYMENT_REMOVED: 'Workshop payment removed',
  REPLACE_CAR: 'Car replaced',
  HOLD_DEPOSIT: 'Deposit put on hold',
  RELEASE_DEPOSIT: 'Held deposit settled',
  DELETE_BOOKING: 'Booking deleted',
  SUBMIT_DEPOSIT: 'Deposit submitted',
  UPLOAD_DEPOSIT_RECEIPT: 'Deposit receipt uploaded',
  VERIFY_DEPOSIT: 'Deposit verified',
  REJECT_DEPOSIT: 'Deposit rejected',
  CONFIRM_BOOKING: 'Booking confirmed',
  UPLOAD_FULL_PAYMENT: 'Full payment receipt uploaded',
  VERIFY_FULL_PAYMENT: 'Full payment verified',
  CHANGE_FULL_PAYMENT_STATUS: 'Full payment to pay again',
  MARK_PICKED_UP: 'Car picked up',
  MARK_RETURNED: 'Car returned',
  CANCEL_BOOKING: 'Booking cancelled',
  REACTIVATE_EXPIRED: 'Expired booking reactivated',
  DEPOSIT_TO_CREDIT: 'Deposit added to customer credit',
  RETURN_APPLIED_CREDIT: 'Applied credit given back',
  CHANGE_DATES: 'Dates changed',
  CHANGE_PRICE: 'Price changed',
  AUTO_RELEASE_UNVERIFIED_DEPOSIT: 'Released: deposit not verified in 48 hours',
  ADMIN_CREATE_BOOKING: 'Booking created by admin',
  SIGN_AGREEMENT: 'Rental agreement signed',
  VIEW_DOCUMENTS: 'Documents viewed',
};

function auditLabel(action) {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  const words = action.replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function auditDetail({ action, details = {} }) {
  const d = details || {};
  if (action === 'CHANGE_DATES') return `${d.from} → ${d.to}`;
  if (action === 'CHANGE_PRICE') return `${formatMYR(d.total_from)} → ${formatMYR(d.total_to)}`;
  if (action === 'REACTIVATE_EXPIRED') return d.reason || null;
  if (action === 'CHARGE_ADDED')
    return `${d.label}${d.description ? ` (${d.description})` : ''} ${formatMYR(d.amount)}`;
  if (action === 'CHARGE_REMOVED') return `${formatMYR(d.amount)} — ${d.reason}`;
  if (action === 'WORKSHOP_PAYMENT') return `${d.workshop} ${formatMYR(d.amount)}`;
  if (action === 'REPLACE_CAR')
    return `${d.from_plate || d.from_car} → ${d.to_plate || d.to_car} from ${formatDate(d.from_date)}`;
  if (action === 'WORKSHOP_PAYMENT_REMOVED')
    return `${d.workshop} ${formatMYR(d.amount)} — ${d.reason}`;
  if (action === 'SIGN_AGREEMENT') return d.in_person ? 'in person at the counter' : null;
  const amount = d.amount ?? d.credit_returned;
  return Number(amount) > 0 ? formatMYR(amount) : null;
}

export default function AdminBookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { activeFleetId } = useFleet();
  const toast = useToast();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [agreement, setAgreement] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);

  // Date editing
  const [editingDates, setEditingDates] = useState(false);
  const [editPickup, setEditPickup] = useState('');
  const [editReturn, setEditReturn] = useState('');
  const [reactivateReason, setReactivateReason] = useState('');
  const [showReactivate, setShowReactivate] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [savingDates, setSavingDates] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  // Full payment receipt upload
  const [fullPaymentFile, setFullPaymentFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        console.log('[BookingDetail] Fetching booking:', id, 'activeFleetId:', activeFleetId);

        // Admin-direct query: fetch by ID without user_id filter
        const { data: bookingData, error: bookingErr } = await supabase
          .from('bubatrent_booking_bookings')
          .select(BOOKING_SELECT)
          .eq('id', id)
          .maybeSingle();

        if (bookingErr) {
          console.error('[BookingDetail] Query error:', bookingErr);
          throw bookingErr;
        }
        if (!bookingData) {
          console.warn('[BookingDetail] No booking found for id:', id);
          setNotFound(true);
          return;
        }

        console.log(
          '[BookingDetail] Booking loaded:',
          bookingData.id,
          'status:',
          bookingData.status
        );
        setBooking(bookingData);
        setEditPickup(bookingData.pickup_date);
        setEditReturn(bookingData.return_date);

        // Fetch docs, logs, and agreement in parallel
        try {
          const [docsData, logsData, agreementData] = await Promise.all([
            getBookingDocuments(id, user.id).catch((err) => {
              console.warn('[BookingDetail] Docs error:', err);
              return [];
            }),
            getAuditLogs(id).catch((err) => {
              console.warn('[BookingDetail] Logs error:', err);
              return [];
            }),
            supabase
              .from('bubatrent_booking_rental_agreements')
              .select('id, agreed_at, customer_name, signature_data, signed_in_person_by')
              .eq('booking_id', id)
              .maybeSingle()
              .then((r) => r.data)
              .catch(() => null),
          ]);
          setDocuments(docsData);
          setAuditLogs(logsData);
          setAgreement(agreementData);

          if (bookingData.user_id) {
            const { data: prof } = await supabase
              .from('bubatrent_booking_profiles')
              .select('*')
              .eq('id', bookingData.user_id)
              .maybeSingle();
            setCustomerProfile(prof);
          }
        } catch (subErr) {
          console.warn('[BookingDetail] Error fetching docs/logs/profile:', subErr);
        }
      } catch (err) {
        console.error('[BookingDetail] Error fetching booking:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id, user.id, activeFleetId]);

  function copyAgreementLink() {
    const url = `${window.location.origin}/booking/${id}/agreement`;
    navigator.clipboard.writeText(url);
    toast.success('Agreement link copied! Share with the customer via WhatsApp.');
  }

  // Re-reads the booking and its audit log after a change: the database
  // stamps updated_at, writes the audit entries and may credit the deposit.
  async function reloadBooking() {
    const [{ data: fresh }, logs] = await Promise.all([
      supabase.from('bubatrent_booking_bookings').select(BOOKING_SELECT).eq('id', id).maybeSingle(),
      getAuditLogs(id).catch(() => null),
    ]);
    if (fresh) setBooking(fresh);
    if (logs) setAuditLogs(logs);
    return logs || [];
  }

  async function handleStatusChange(newStatus) {
    // The database enforces these rules too; checking here gives a clearer message.
    if (newStatus === 'CONFIRMED' && booking.deposit_status !== 'verified') {
      toast.error(
        'Cannot confirm yet — the deposit has not been verified. Check the receipt under Payment Receipts first.'
      );
      return;
    }
    if (newStatus === 'PICKUP' && !agreement) {
      toast.error(
        'Cannot mark as Picked Up — rental agreement has not been signed yet. Send the customer the agreement link, or use Sign at Counter.'
      );
      return;
    }
    // Only the rental payment counts; the security deposit is not rent.
    if (newStatus === 'PICKUP' && booking.full_payment_status !== 'verified') {
      toast.error(
        `Cannot mark as Picked Up — the full rental payment (${formatMYR(rentDue(booking))}) has not been verified yet.`
      );
      return;
    }

    try {
      // (Returning a car goes through ReturnCarDialog, which handles charges.)
      const { error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      const logs = await reloadBooking();
      const credited = logs.find((l) => l.action === 'DEPOSIT_TO_CREDIT');
      if (newStatus === 'CANCELLED' && credited) {
        toast.success(
          `Booking cancelled. Deposit ${formatMYR(credited.details?.amount)} added to the customer's credit.`
        );
      } else {
        toast.success(`Status updated to ${newStatus}`);
      }
    } catch (err) {
      toast.error(friendlyDbError(err));
    }
  }

  async function handleVerify(docId) {
    try {
      await verifyDocument(docId, user.id);
      const docsData = await getBookingDocuments(id, user.id);
      setDocuments(docsData);
      const logsData = await getAuditLogs(id);
      setAuditLogs(logsData);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSaveDates() {
    setSavingDates(true);
    try {
      await expireStaleHolds();
      const { error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({ pickup_date: editPickup, return_date: editReturn })
        .eq('id', id);
      if (error) throw error;
      await reloadBooking();
      setEditingDates(false);
      toast.success('Dates updated!');
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setSavingDates(false);
    }
  }

  async function handleVerifyDeposit() {
    try {
      // One server step: marks the deposit and its payment verified. The
      // deposit goes to the customer's credit when the car is returned.
      const { data: result, error } = await supabase.rpc('bubatrent_admin_verify_deposit', {
        p_booking_id: id,
      });
      if (error) throw error;
      if (result?.status === 'already_verified') {
        toast.info('This deposit was already verified.');
        return;
      }
      await reloadBooking();
      toast.success("Deposit verified. It goes to the customer's credit when the car is returned.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleRejectDeposit() {
    try {
      const { error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({ deposit_status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
      await reloadBooking();
      toast.success('Deposit receipt rejected.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleVerifyFullPayment() {
    try {
      // One server step: marks it verified and records what was left to pay
      // (the rental less anything the customer paid the workshop for us)
      const { data: result, error } = await supabase.rpc('bubatrent_admin_verify_full_payment', {
        p_booking_id: id,
      });
      if (error) throw error;
      if (result?.status === 'already_verified') {
        toast.info('This full payment was already verified.');
        return;
      }
      await reloadBooking();
      toast.success('Full payment verified!');
    } catch (err) {
      toast.error(friendlyDbError(err));
    }
  }

  async function handleUploadFullPayment() {
    if (!fullPaymentFile) {
      toast.error('Select a receipt file first.');
      return;
    }
    setUploadingReceipt(true);
    try {
      const ext = fullPaymentFile.name.split('.').pop();
      const path = `receipts/${id}/full_payment_${Date.now()}.${ext}`;
      const { error: upErr } = await uploadFileRobust(
        'customer-documents',
        path,
        fullPaymentFile,
        toast
      );
      if (upErr) throw upErr;
      const { error } = await supabase
        .from('bubatrent_booking_bookings')
        .update({ full_payment_receipt_path: path, full_payment_status: 'uploaded' })
        .eq('id', id);
      if (error) throw error;
      await reloadBooking();
      setFullPaymentFile(null);
      toast.success('Full payment receipt uploaded!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingReceipt(false);
    }
  }

  // Delete the booking and its payments. The customer's credit history stays;
  // the database first gives back any credit or verified deposit the booking
  // still holds, and logs the deletion.
  async function handleDeleteBooking() {
    const confirmMsg = `Are you sure you want to DELETE this booking?\n\nCar: ${booking.bubatrent_booking_cars?.name || 'Unknown'}\nDates: ${booking.pickup_date} → ${booking.return_date}\nStatus: ${booking.status}\n\nThis will permanently delete:\n• The booking record, its payments and its signed agreement\n\nKept: the customer's credit history and the audit log. Credit the customer applied, or a verified deposit not yet returned, goes back to their credit balance.\n\nTo stop a real booking, Cancel it instead. This action CANNOT be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      // Payments reference the booking, so they go first
      const { error: payErr } = await supabase
        .from('bubatrent_booking_payments')
        .delete()
        .eq('booking_id', id);
      if (payErr) throw payErr;
      // Delete the booking itself
      const { data: deleted, error } = await supabase
        .from('bubatrent_booking_bookings')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!deleted?.length)
        throw new Error('The booking could not be deleted (permission denied).');

      toast.success('Booking deleted successfully');
      navigate('/admin/bookings');
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <AdminLayout>
        <LoadingSpinner fullScreen />
      </AdminLayout>
    );
  if (notFound || !booking)
    return (
      <AdminLayout>
        <p className="text-red-400">Booking not found or you don&apos;t have access.</p>
        <p className="text-xs text-slate-500 mt-1">ID: {id}</p>
        <Link
          to="/admin/bookings"
          className="text-violet-400 text-sm mt-3 inline-block hover:underline"
        >
          ← Back to Bookings
        </Link>
      </AdminLayout>
    );

  const car = booking.bubatrent_booking_cars;
  const payments = [...(booking.bubatrent_booking_payments || [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  const charges = [...(booking.bubatrent_booking_charges || [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  const nextStatuses = STATUS_FLOW[booking.status] || [];
  const paidToWorkshop = rentPaidToWorkshop(booking);
  const rentPaid = Number(booking.rent_paid || 0);
  // Rent can be recorded while some is left to pay and no receipt waits
  const rentOpen =
    ['CONFIRMED', 'PICKUP', 'RETURNED'].includes(booking.status) &&
    !['verified', 'uploaded'].includes(booking.full_payment_status);
  // No receipt to check (a counter booking, or a hold an admin marked as
  // deposit paid): the admin records the cash deposit
  const depositAwaitingCash =
    ['pending', 'pending_upload'].includes(booking.deposit_status) &&
    !booking.deposit_receipt_path &&
    ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'].includes(booking.status);

  return (
    <AdminLayout>
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> All Bookings
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            Booking Detail <BookingStatusBadge status={booking.status} />
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">{booking.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((ns) => (
            <button
              key={ns}
              onClick={() => {
                if (booking.status === 'EXPIRED') {
                  setShowReactivate(true);
                  return;
                }
                if (ns === 'RETURNED') {
                  setShowReturn(true);
                  return;
                }
                handleStatusChange(ns);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                ns === 'CANCELLED'
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : ns === 'RETURNED'
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
            >
              {ns === 'DEPOSIT_PAID'
                ? booking.status === 'EXPIRED'
                  ? 'Reactivate → Deposit Paid'
                  : 'Mark Deposit Paid'
                : ns === 'CONFIRMED'
                  ? booking.status === 'EXPIRED'
                    ? 'Reactivate → Confirmed'
                    : 'Confirm'
                  : ns === 'PICKUP'
                    ? 'Mark Picked Up'
                    : ns === 'RETURNED'
                      ? 'Mark Returned'
                      : ns === 'CANCELLED'
                        ? 'Cancel'
                        : ns}
            </button>
          ))}
          <button
            onClick={handleDeleteBooking}
            disabled={deleting}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Rental Agreement Status Card (online customers sign at checkout) */}
      {['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED'].includes(booking.status) && (
        <div
          className={`glass-card mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${agreement ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}
        >
          <div className="flex items-center gap-3 flex-1">
            <FileSignature
              className={`w-6 h-6 shrink-0 ${agreement ? 'text-green-400' : 'text-amber-400'}`}
            />
            <div>
              <p
                className={`text-sm font-medium ${agreement ? 'text-green-300' : 'text-amber-300'}`}
              >
                {agreement ? 'Rental Agreement Signed' : 'Rental Agreement Not Signed'}
              </p>
              <p className="text-xs text-slate-500">
                {agreement
                  ? `Signed by ${agreement.customer_name} on ${formatDateTime(agreement.agreed_at)}${agreement.signed_in_person_by ? ', in person at the counter' : ''}`
                  : 'Customer must sign the agreement before vehicle pickup: send them the link, or let them sign here on your device.'}
              </p>
            </div>
          </div>
          {!agreement && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyAgreementLink}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors whitespace-nowrap"
              >
                <ClipboardCopy className="w-4 h-4" />
                Copy Agreement Link
              </button>
              {booking.status !== 'RETURNED' && (
                <Link
                  to={`/booking/${id}/agreement`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                >
                  <FileSignature className="w-4 h-4" />
                  Sign at Counter
                </Link>
              )}
            </div>
          )}
          {agreement && (
            <div className="flex items-center gap-3">
              {agreement.signature_data && (
                <div className="bg-white rounded-lg p-2 w-32 h-16">
                  <img
                    src={agreement.signature_data}
                    alt="Signature"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <a
                href={`/booking/${id}/agreement`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" /> View Full Agreement
              </a>
            </div>
          )}
        </div>
      )}

      {showReturn && (
        <ReturnCarDialog
          booking={booking}
          onClose={() => setShowReturn(false)}
          onDone={() => {
            setShowReturn(false);
            reloadBooking();
          }}
        />
      )}

      {/* Reactivation Modal */}
      {showReactivate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowReactivate(false)}
        >
          <div
            className="glass-card w-full max-w-md animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Reactivate Expired Booking</h3>
            <p className="text-sm text-slate-400 mb-4">
              This booking expired. Provide a reason for reactivation:
            </p>
            <textarea
              value={reactivateReason}
              onChange={(e) => setReactivateReason(e.target.value)}
              className="input-field mb-4"
              rows={3}
              placeholder="Reason for reactivation (required)..."
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setShowReactivate(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              {nextStatuses
                .filter((s) => s !== 'CANCELLED')
                .map((ns) => (
                  <button
                    key={ns}
                    disabled={!reactivateReason.trim() || reactivating}
                    onClick={async () => {
                      setReactivating(true);
                      try {
                        await expireStaleHolds();
                        // Check date overlap
                        const { data: overlapping } = await supabase
                          .from('bubatrent_booking_bookings')
                          .select('id')
                          .eq('car_id', booking.car_id)
                          .in('status', ['HOLD', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'])
                          .lte('pickup_date', booking.return_date)
                          .gte('return_date', booking.pickup_date)
                          .neq('id', booking.id)
                          .limit(1);
                        if (overlapping?.length > 0) {
                          toast.error(
                            'Cannot reactivate: date overlap with another booking. Edit dates first.'
                          );
                          setReactivating(false);
                          return;
                        }
                        const { error: reactivateErr } = await supabase
                          .from('bubatrent_booking_bookings')
                          .update({
                            status: ns,
                            reactivated_by: user.id,
                            reactivated_at: new Date().toISOString(),
                            reactivation_reason: reactivateReason,
                          })
                          .eq('id', booking.id);
                        if (reactivateErr) throw reactivateErr;
                        // The database logs the reactivation with its reason
                        await reloadBooking();
                        toast.success(`Booking reactivated → ${ns}`);
                        setShowReactivate(false);
                        setReactivateReason('');
                      } catch (err) {
                        toast.error(friendlyDbError(err));
                      } finally {
                        setReactivating(false);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20 transition-all disabled:opacity-30"
                  >
                    {reactivating
                      ? 'Activating...'
                      : `→ ${ns === 'DEPOSIT_PAID' ? 'Deposit Paid' : 'Confirmed'}`}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Car & Dates */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Rental Details
              </h3>
              {!editingDates && ['HOLD', 'DEPOSIT_PAID', 'CONFIRMED'].includes(booking.status) && (
                <button
                  onClick={() => setEditingDates(true)}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Dates
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 mb-4">
              {car?.image_url && (
                <img
                  src={car.image_url}
                  alt={car?.name}
                  className="w-24 h-16 rounded-xl object-cover"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold">{car?.name}</p>
                  {car?.plate_number && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      {car.plate_number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {car?.brand} {car?.model} · {car?.year}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1">Pick-up</p>
                {editingDates ? (
                  <input
                    type="date"
                    value={editPickup}
                    onChange={(e) => setEditPickup(e.target.value)}
                    className="input-field !py-1.5 text-sm"
                  />
                ) : (
                  <p className="text-white">{formatDate(booking.pickup_date)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Return</p>
                {editingDates ? (
                  <input
                    type="date"
                    value={editReturn}
                    onChange={(e) => setEditReturn(e.target.value)}
                    className="input-field !py-1.5 text-sm"
                  />
                ) : (
                  <p className="text-white">{formatDate(booking.return_date)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Total</p>
                <p className="text-white font-semibold">{formatMYR(booking.total_price)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Deposit</p>
                <p className="text-green-400 font-semibold">{formatMYR(booking.deposit_amount)}</p>
              </div>
            </div>
            {editingDates && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveDates}
                  disabled={savingDates}
                  className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> {savingDates ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingDates(false);
                    setEditPickup(booking.pickup_date);
                    setEditReturn(booking.return_date);
                  }}
                  className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            )}
            {booking.actual_return_date && (
              <p className="text-xs text-emerald-400 mt-3">
                Actual return: {formatDate(booking.actual_return_date)}
              </p>
            )}
            {Number(booking.credit_applied || 0) > 0 && (
              <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Credit applied: {formatMYR(booking.credit_applied)}
              </p>
            )}
          </div>

          {/* Customer Info */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Customer
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-violet-400" />
                <span className="text-white">{booking.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-violet-400" />
                <span className="text-slate-300">{booking.customer_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-violet-400" />
                <span className="text-slate-300">{booking.customer_phone}</span>
              </div>
              {booking.notes && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-violet-400 mt-0.5" />
                  <span className="text-slate-300">{booking.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Receipt Verification */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileCheck className="w-4 h-4" /> Payment Receipts
            </h3>
            <div className="space-y-4">
              {/* Deposit Receipt */}
              <div className="bg-white/[0.02] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-white font-medium">Deposit Receipt</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      booking.deposit_status === 'verified'
                        ? 'bg-green-500/10 text-green-400'
                        : booking.deposit_status === 'uploaded'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : booking.deposit_status === 'rejected'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {booking.deposit_status || 'pending'}
                  </span>
                </div>
                {booking.deposit_receipt_path && (
                  <SignedLink
                    path={booking.deposit_receipt_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 mb-2"
                  >
                    <Eye className="w-3 h-3" /> View Receipt
                  </SignedLink>
                )}
                {booking.status === 'DEPOSIT_PAID' &&
                  booking.deposit_status !== 'verified' &&
                  booking.deposit_review_due_at && (
                    <p className="text-xs text-amber-400 mb-2">
                      Released automatically on {formatDateTime(booking.deposit_review_due_at)}{' '}
                      unless verified.
                    </p>
                  )}
                {booking.deposit_status === 'uploaded' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleVerifyDeposit}
                      className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      ✓ Verify
                    </button>
                    <button
                      onClick={handleRejectDeposit}
                      className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
                {depositAwaitingCash && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Record that the customer paid the ${formatMYR(booking.deposit_amount)} deposit in cash?`
                        )
                      )
                        handleVerifyDeposit();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors mt-2"
                  >
                    ✓ Mark Deposit Received
                  </button>
                )}
                {booking.deposit_status === 'verified' && (
                  <p className="text-xs text-slate-400 mt-2">
                    {booking.deposit_credited_at
                      ? `Added to the customer's credit on ${formatDateTime(booking.deposit_credited_at)}${Number(booking.charges_total) > 0 ? ', less charges (see Return & Charges)' : ''}.`
                      : booking.deposit_on_hold
                        ? 'On hold after the return. Settle it under Return & Charges.'
                        : "Held until the car is returned, then added to the customer's credit less any charges."}
                  </p>
                )}
              </div>

              {/* Full Payment */}
              <div className="bg-white/[0.02] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-white font-medium">
                    Full Payment (
                    {formatMYR(
                      booking.full_payment_status === 'verified'
                        ? rentalAmount(booking)
                        : rentDue(booking)
                    )}
                    )
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      booking.full_payment_status === 'verified'
                        ? 'bg-green-500/10 text-green-400'
                        : booking.full_payment_status === 'uploaded'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {booking.full_payment_status || 'pending'}
                  </span>
                </div>
                {rentPaid > 0 && booking.full_payment_status !== 'verified' && (
                  <p className="text-xs text-slate-400 mb-2">
                    Rental {formatMYR(rentalAmount(booking))}: {formatMYR(rentPaid)} already paid
                    {paidToWorkshop > 0 &&
                      ` (including ${formatMYR(paidToWorkshop)} paid to the workshop for us)`}
                    , {formatMYR(rentDue(booking))} left to pay.
                  </p>
                )}
                {booking.full_payment_status === 'verified' && paidToWorkshop > 0 && (
                  <p className="text-xs text-slate-400 mb-2">
                    Includes {formatMYR(paidToWorkshop)} the customer paid the workshop for us (see
                    Paid to Workshop).
                  </p>
                )}
                {booking.full_payment_receipt_path && (
                  <SignedLink
                    path={booking.full_payment_receipt_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 mb-2"
                  >
                    <Eye className="w-3 h-3" /> View Receipt
                  </SignedLink>
                )}
                {booking.full_payment_status === 'uploaded' && (
                  <button
                    onClick={handleVerifyFullPayment}
                    className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors mt-2"
                  >
                    ✓ Verify Full Payment
                  </button>
                )}
                {/* Rent paid in cash at the counter: no receipt to check */}
                {rentOpen && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Record that the customer paid the ${formatMYR(rentDue(booking))} rent left to pay, in cash?`
                        )
                      )
                        handleVerifyFullPayment();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors mt-2"
                  >
                    ✓ Mark Full Payment Received (cash)
                  </button>
                )}
                {/* Allow admin to upload full payment receipt on behalf of customer */}
                {rentOpen && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <FileImage className="w-3.5 h-3.5" />
                      {fullPaymentFile ? fullPaymentFile.name : 'Upload receipt'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setFullPaymentFile(e.target.files[0])}
                      />
                    </label>
                    {fullPaymentFile && (
                      <button
                        onClick={handleUploadFullPayment}
                        disabled={uploadingReceipt}
                        className="px-3 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                      >
                        {uploadingReceipt ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Official Invoice */}
            {(booking.deposit_status === 'verified' ||
              booking.full_payment_status === 'verified') && (
              <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Official Invoice / Receipt</p>
                    <p className="text-xs text-slate-500">Auto-generated company invoice</p>
                  </div>
                  <a
                    href={`/booking/${id}/invoice`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Invoice
                  </a>
                </div>
              </div>
            )}
          </div>

          {(RENTAL_CHANGE_STATUSES.includes(booking.status) ||
            rentalChanges(booking).length > 0) && (
            <RentalChangesCard booking={booking} onChanged={reloadBooking} />
          )}

          {(WORKSHOP_STATUSES.includes(booking.status) || workshopPayments(booking).length > 0) && (
            <WorkshopPaymentsCard booking={booking} onChanged={reloadBooking} />
          )}

          {(booking.status === 'RETURNED' || charges.length > 0) && (
            <ChargesCard
              booking={booking}
              charges={charges}
              payments={payments}
              onChanged={reloadBooking}
            />
          )}

          {/* Documents */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4" /> Identity Documents
              </h3>
              {customerProfile?.is_verified && (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                  <CheckCircle className="w-3.5 h-3.5" /> Customer Verified
                </span>
              )}
            </div>

            {/* Profile-level documents */}
            {customerProfile &&
              (customerProfile.ic_file_path || customerProfile.licence_file_path) && (
                <div className="mb-4 space-y-3">
                  <p className="text-xs text-slate-400 font-medium">Customer Profile Documents:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* IC */}
                    <div
                      className={`rounded-xl border p-3 ${customerProfile.ic_file_path ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 bg-white/[0.02]'}`}
                    >
                      <p className="text-[11px] font-medium text-slate-400 mb-2">IC Document</p>
                      {customerProfile.ic_file_path ? (
                        <SignedLink
                          path={customerProfile.ic_file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {customerProfile.ic_file_path.toLowerCase().endsWith('.pdf') ? (
                            <div className="flex items-center justify-center gap-2 h-20 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20 font-semibold">
                              <FileText className="w-5 h-5" /> View IC (PDF)
                            </div>
                          ) : (
                            <SignedImage
                              path={customerProfile.ic_file_path}
                              alt="IC Document"
                              className="w-full h-24 object-cover rounded-lg hover:opacity-80 transition-opacity"
                            />
                          )}
                        </SignedLink>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Not uploaded</p>
                      )}
                      {customerProfile.ic_number && (
                        <p className="text-xs text-slate-400 mt-2">
                          <span className="text-slate-500">IC:</span> {customerProfile.ic_number}
                        </p>
                      )}
                    </div>

                    {/* Licence */}
                    <div
                      className={`rounded-xl border p-3 ${customerProfile.licence_file_path ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 bg-white/[0.02]'}`}
                    >
                      <p className="text-[11px] font-medium text-slate-400 mb-2">Driving Licence</p>
                      {customerProfile.licence_file_path ? (
                        <SignedLink
                          path={customerProfile.licence_file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {customerProfile.licence_file_path.toLowerCase().endsWith('.pdf') ? (
                            <div className="flex items-center justify-center gap-2 h-20 rounded-lg bg-blue-500/10 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20 font-semibold">
                              <FileText className="w-5 h-5" /> View Licence (PDF)
                            </div>
                          ) : (
                            <SignedImage
                              path={customerProfile.licence_file_path}
                              alt="Driving Licence"
                              className="w-full h-24 object-cover rounded-lg hover:opacity-80 transition-opacity"
                            />
                          )}
                        </SignedLink>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Not uploaded</p>
                      )}
                      {customerProfile.licence_expiry && (
                        <p className="text-xs text-slate-400 mt-2">
                          <span className="text-slate-500">Expiry:</span>{' '}
                          {formatDate(customerProfile.licence_expiry)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* Booking-level documents */}
            {documents.length === 0 &&
            (!customerProfile ||
              (!customerProfile.ic_file_path && !customerProfile.licence_file_path)) ? (
              <p className="text-sm text-slate-500">No documents uploaded yet.</p>
            ) : (
              documents.length > 0 && (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-white/[0.02] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-violet-400" />
                          <span className="text-sm text-white">Booking Document</span>
                        </div>
                        {doc.verified_at ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerify(doc.id)}
                            className="px-3 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                        {doc.ic_number && (
                          <div>
                            <p className="text-slate-500">IC No.</p>
                            <p className="text-slate-200">{maskSensitive(doc.ic_number)}</p>
                          </div>
                        )}
                        {doc.licence_expiry && (
                          <div>
                            <p className="text-slate-500">Expiry</p>
                            <p className="text-slate-200">{formatDate(doc.licence_expiry)}</p>
                          </div>
                        )}
                      </div>
                      {/* Document file links */}
                      <div className="flex gap-3 text-xs mt-2">
                        {doc.ic_file_path && (
                          <SignedLink
                            path={doc.ic_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View IC
                          </SignedLink>
                        )}
                        {doc.licence_file_path && (
                          <SignedLink
                            path={doc.licence_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Licence
                          </SignedLink>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Sidebar - Payment & Audit */}
        <div className="space-y-6">
          {/* Payments */}
          {payments.length > 0 && (
            <div className="glass-card">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                {payments.length > 1 ? 'Payment Records' : 'Payment Record'}
              </h3>
              <div className="divide-y divide-white/5">
                {payments.map((payment) => (
                  <div key={payment.id} className="space-y-2 text-sm py-3 first:pt-0 last:pb-0">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Type</span>
                      <span className="text-slate-300">
                        {payment.payment_type === 'full_payment'
                          ? 'Full payment'
                          : payment.payment_type === 'charge'
                            ? 'Charge payment'
                            : 'Deposit'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount</span>
                      <span className="text-white">{formatMYR(payment.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Method</span>
                      <span className="text-slate-300 capitalize">
                        {(payment.payment_method || '').replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`capitalize ${
                          payment.status === 'completed'
                            ? 'text-green-400'
                            : payment.status === 'pending'
                              ? 'text-yellow-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference</span>
                      <span className="text-xs font-mono text-slate-300">
                        {payment.reference_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date</span>
                      <span className="text-xs text-slate-300">
                        {formatDateTime(payment.created_at)}
                      </span>
                    </div>
                    {payment.receipt_path && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Receipt</span>
                        <SignedLink
                          path={payment.receipt_path}
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </SignedLink>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <BookingRecordsCard bookingId={booking.id} />

          {/* Audit Log */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Audit Log
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No audit entries.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {auditLogs.map((log) => {
                  const detail = auditDetail(log);
                  return (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-slate-300">
                          {auditLabel(log.action)}
                          {detail && <span className="text-slate-500"> · {detail}</span>}
                        </p>
                        <p className="text-slate-600">
                          {log.bubatrent_booking_profiles?.display_name ||
                            (log.admin_id ? 'Admin' : 'System')}{' '}
                          · {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Timeline
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-300">{formatDateTime(booking.created_at)}</span>
              </div>
              {booking.updated_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Updated</span>
                  <span className="text-slate-300">{formatDateTime(booking.updated_at)}</span>
                </div>
              )}
              {booking.actual_return_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Returned</span>
                  <span className="text-emerald-400">{formatDate(booking.actual_return_date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
