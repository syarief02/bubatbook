import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';
import BookingStatusBadge from '../components/BookingStatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/dates';
import { formatMYR } from '../utils/pricing';
import { CalendarDays, ExternalLink, Car } from 'lucide-react';

export default function MyBookings() {
  const { user } = useAuth();
  const { bookings, loading, error } = useBookings(user?.id);

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
              <Car className="w-4 h-4" />
              Browse Cars
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, i) => {
            const car = booking.bubatrent_booking_cars;
            return (
              <div
                key={booking.id}
                className="glass-card glass-card-hover animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Car image */}
                  {car?.image_url && (
                    <img
                      src={car.image_url}
                      alt={car?.name}
                      className="w-full sm:w-32 h-24 rounded-xl object-cover shrink-0"
                    />
                  )}

                  {/* Booking info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-white font-semibold">{car?.name || 'Car'}</h3>
                        <p className="text-xs text-slate-500">{car?.brand} {car?.model}</p>
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
                        <p className="text-slate-500">Total</p>
                        <p className="text-slate-200">{formatMYR(booking.total_price)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Deposit</p>
                        <p className="text-green-400">{formatMYR(booking.deposit_amount)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {booking.status === 'PAID' && (
                        <Link
                          to={`/booking/${booking.id}/documents`}
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                        >
                          Upload Documents <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      <Link
                        to={`/booking/${booking.id}/confirmation`}
                        className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
                      >
                        View Details <ExternalLink className="w-3 h-3" />
                      </Link>
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
