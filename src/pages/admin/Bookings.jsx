import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminBookings, updateBookingStatus } from '../../hooks/useAdmin';
import { useToast } from '../../components/Toast';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';
import { CalendarDays, ExternalLink, Filter, Search, Hash } from 'lucide-react';

const STATUSES = ['ALL', 'HOLD', 'PAID', 'CONFIRMED', 'CANCELLED', 'EXPIRED'];

export default function AdminBookings() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [customerSearch, setCustomerSearch] = useState('');
  const { bookings, loading, error, refetch } = useAdminBookings(
    statusFilter === 'ALL' ? {} : { status: statusFilter }
  );

  // Client-side filter by customer name/email
  const filteredBookings = bookings.filter(b => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return (b.customer_name || '').toLowerCase().includes(q)
      || (b.customer_email || '').toLowerCase().includes(q)
      || b.id.toLowerCase().startsWith(q);
  });

  async function handleStatusChange(bookingId, newStatus) {
    try {
      await updateBookingStatus(bookingId, newStatus);
      toast.success(`Booking ${newStatus.toLowerCase()} successfully`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Bookings">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search customer name, email, or booking ID..."
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            className="input-field !pl-10 !py-2 text-sm"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-slate-500 shrink-0" />
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === s
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {s}
          </button>
        ))}
        <span className="text-xs text-slate-600 ml-auto whitespace-nowrap">
          {filteredBookings.length} result{filteredBookings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="glass-card text-center"><p className="text-red-400">{error}</p></div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings found"
          description={customerSearch ? 'Try a different search term' : statusFilter !== 'ALL' ? `No ${statusFilter} bookings.` : 'No bookings yet.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredBookings.map(booking => {
            const car = booking.bubatrent_booking_cars;
            return (
              <div key={booking.id} className="glass-card">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Car info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {car?.image_url && (
                      <img src={car.image_url} alt={car.name} className="w-16 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium text-sm truncate">{car?.name || 'Car'}</h3>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500 truncate">
                          {booking.customer_name || 'No name'} · {booking.customer_email || 'No email'}
                        </p>
                        <span className="text-[10px] text-slate-600 font-mono flex items-center gap-0.5 shrink-0">
                          <Hash className="w-2.5 h-2.5" />{booking.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date & Price */}
                  <div className="flex gap-6 text-xs shrink-0">
                    <div>
                      <p className="text-slate-500">Dates</p>
                      <p className="text-slate-200">{formatDate(booking.pickup_date)} → {formatDate(booking.return_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total / Deposit</p>
                      <p className="text-slate-200">{formatMYR(booking.total_price)} / <span className="text-green-400">{formatMYR(booking.deposit_amount)}</span></p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {booking.status === 'PAID' && (
                      <button
                        onClick={() => handleStatusChange(booking.id, 'CONFIRMED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                    {(booking.status === 'HOLD' || booking.status === 'PAID') && (
                      <button
                        onClick={() => handleStatusChange(booking.id, 'CANCELLED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <Link
                      to={`/admin/bookings/${booking.id}`}
                      className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
