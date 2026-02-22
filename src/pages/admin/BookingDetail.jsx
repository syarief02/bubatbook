import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getBooking } from '../../hooks/useBookings';
import { updateBookingStatus, getBookingDocuments, verifyDocument, getAuditLogs } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateTime } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';
import { maskSensitive } from '../../utils/format';
import {
  ArrowLeft, User, Mail, Phone, FileText, Shield, CheckCircle,
  Clock, Eye, FileCheck
} from 'lucide-react';

export default function AdminBookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [bookingData, docsData, logsData] = await Promise.all([
          getBooking(id),
          getBookingDocuments(id, user.id),
          getAuditLogs(id),
        ]);
        setBooking(bookingData);
        setDocuments(docsData);
        setAuditLogs(logsData);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id, user.id]);

  async function handleStatusChange(newStatus) {
    try {
      const updated = await updateBookingStatus(id, newStatus);
      setBooking(prev => ({ ...prev, ...updated }));
    } catch (err) {
      toast.error(err.message);
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

  if (loading) return <AdminLayout><LoadingSpinner fullScreen /></AdminLayout>;
  if (!booking) return <AdminLayout><p className="text-red-400">Booking not found.</p></AdminLayout>;

  const car = booking.bubatrent_booking_cars;
  const payment = booking.bubatrent_booking_payments?.[0];

  return (
    <AdminLayout>
      <Link to="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        All Bookings
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            Booking Detail
            <BookingStatusBadge status={booking.status} />
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">{booking.id}</p>
        </div>
        <div className="flex gap-2">
          {booking.status === 'PAID' && (
            <button onClick={() => handleStatusChange('CONFIRMED')} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
              Confirm
            </button>
          )}
          {(booking.status === 'HOLD' || booking.status === 'PAID') && (
            <button onClick={() => handleStatusChange('CANCELLED')} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Car & Dates */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Rental Details</h3>
            <div className="flex items-center gap-4 mb-4">
              {car?.image_url && (
                <img src={car.image_url} alt={car?.name} className="w-24 h-16 rounded-xl object-cover" />
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
                <p className="text-xs text-slate-500">{car?.brand} {car?.model} · {car?.year}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1">Pick-up</p>
                <p className="text-white">{formatDate(booking.pickup_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Return</p>
                <p className="text-white">{formatDate(booking.return_date)}</p>
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
          </div>

          {/* Customer Info */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Customer</h3>
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

          {/* Documents */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Identity Documents
            </h3>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="bg-white/[0.02] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-violet-400" />
                        <span className="text-sm text-white">Driving Licence</span>
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
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500">Licence No.</p>
                        <p className="text-slate-200">{maskSensitive(doc.licence_number)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Expiry</p>
                        <p className="text-slate-200">{formatDate(doc.licence_expiry)}</p>
                      </div>
                      {doc.ic_number && (
                        <div>
                          <p className="text-slate-500">IC No.</p>
                          <p className="text-slate-200">{maskSensitive(doc.ic_number)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Payment & Audit */}
        <div className="space-y-6">
          {/* Payment */}
          {payment && (
            <div className="glass-card">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Payment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="text-white">{formatMYR(payment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method</span>
                  <span className="text-slate-300 capitalize">{payment.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="text-green-400 capitalize">{payment.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference</span>
                  <span className="text-xs font-mono text-slate-300">{payment.reference_number}</span>
                </div>
              </div>
            </div>
          )}

          {/* Audit Log */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Audit Log
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No audit entries.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-300">
                        {log.action.replace('_', ' ')}
                      </p>
                      <p className="text-slate-600">
                        {log.bubatrent_booking_profiles?.display_name || log.bubatrent_booking_profiles?.username || 'Admin'} · {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booking Timeline */}
          <div className="glass-card">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Timeline</h3>
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
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
