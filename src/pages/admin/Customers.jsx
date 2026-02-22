import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminCustomers, updateUserRole, getCustomerBookings } from '../../hooks/useAdmin';
import AdminLayout from '../../components/AdminLayout';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';
import {
  Search, Users, Shield, ShieldOff, Mail, Phone, CalendarDays,
  ChevronDown, ChevronUp, X, AlertTriangle
} from 'lucide-react';

const ROLE_OPTIONS = ['ALL', 'customer', 'admin'];

export default function Customers() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState(null);
  const [confirmRole, setConfirmRole] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { customers, loading, refetch } = useAdminCustomers({
    search: debouncedSearch,
    role: roleFilter,
  });

  async function handleExpand(customerId) {
    if (expandedId === customerId) {
      setExpandedId(null);
      setBookings([]);
      return;
    }
    setExpandedId(customerId);
    setBookingsLoading(true);
    try {
      const data = await getCustomerBookings(customerId);
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }

  async function handleRoleChange(customerId, newRole) {
    if (customerId === user?.id) return; // Can't change own role
    setRoleChanging(customerId);
    try {
      await updateUserRole(customerId, newRole, user.id);
      await refetch();
      setConfirmRole(null);
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    } finally {
      setRoleChanging(null);
    }
  }

  return (
    <AdminLayout title="Customer Management">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
        <div className="flex gap-2">
          {ROLE_OPTIONS.map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                roleFilter === role
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'glass-card text-slate-400 hover:text-white'
              }`}
            >
              {role === 'ALL' ? 'All' : role === 'admin' ? '🛡️ Admin' : '👤 Customer'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-6 text-sm text-slate-400">
        <span>{customers.length} user{customers.length !== 1 ? 's' : ''} found</span>
        <span>•</span>
        <span>{customers.filter(c => c.role === 'admin').length} admin{customers.filter(c => c.role === 'admin').length !== 1 ? 's' : ''}</span>
      </div>

      {/* Customer List */}
      {loading ? (
        <LoadingSpinner />
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" message={search ? 'Try a different search term' : 'No registered users yet'} />
      ) : (
        <div className="space-y-3">
          {customers.map(customer => (
            <div key={customer.id} className="glass-card">
              {/* Main row */}
              <div
                className="flex items-center gap-4 cursor-pointer p-4 hover:bg-white/[0.02] transition-colors rounded-xl"
                onClick={() => handleExpand(customer.id)}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  customer.role === 'admin'
                    ? 'bg-gradient-to-br from-violet-500 to-indigo-600'
                    : 'bg-gradient-to-br from-slate-600 to-slate-700'
                }`}>
                  <span className="text-white font-semibold text-sm">
                    {(customer.display_name || customer.username || '?')[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {customer.display_name || 'Unnamed'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      customer.role === 'admin'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {customer.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3" /> {customer.username}
                    </span>
                    {customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Booking count */}
                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-lg font-bold text-white">{customer.booking_count}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Bookings</div>
                </div>

                {/* Joined date */}
                <div className="text-right shrink-0 hidden md:block">
                  <div className="text-xs text-slate-400">
                    {customer.created_at ? formatDate(customer.created_at) : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">Joined</div>
                </div>

                {/* Expand arrow */}
                <div className="shrink-0 text-slate-500">
                  {expandedId === customer.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === customer.id && (
                <div className="border-t border-white/5 p-4 animate-fade-in">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Actions */}
                    <div className="lg:w-64 shrink-0 space-y-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</h4>

                      {/* Role toggle */}
                      {customer.id === user?.id ? (
                        <p className="text-xs text-slate-500 italic">Cannot change your own role</p>
                      ) : confirmRole === customer.id ? (
                        <div className="glass-card !p-3 border border-yellow-500/20">
                          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="font-medium">
                              {customer.role === 'admin' ? 'Remove admin access?' : 'Grant admin access?'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRoleChange(customer.id, customer.role === 'admin' ? 'customer' : 'admin')}
                              disabled={roleChanging === customer.id}
                              className="btn-primary text-xs !py-1.5 !px-3 flex-1"
                            >
                              {roleChanging === customer.id ? 'Updating...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmRole(null)}
                              className="btn-secondary text-xs !py-1.5 !px-3"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRole(customer.id)}
                          className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            customer.role === 'admin'
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                              : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20'
                          }`}
                        >
                          {customer.role === 'admin' ? (
                            <><ShieldOff className="w-4 h-4" /> Remove Admin</>
                          ) : (
                            <><Shield className="w-4 h-4" /> Make Admin</>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Booking history */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Booking History
                      </h4>
                      {bookingsLoading ? (
                        <LoadingSpinner />
                      ) : bookings.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No bookings yet</p>
                      ) : (
                        <div className="space-y-2">
                          {bookings.map(b => (
                            <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              {b.bubatrent_booking_cars?.image_url && (
                                <img
                                  src={b.bubatrent_booking_cars.image_url}
                                  alt={b.bubatrent_booking_cars.name}
                                  className="w-12 h-8 rounded-lg object-cover shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {b.bubatrent_booking_cars?.name || 'Unknown Car'}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {formatDate(b.pickup_date)} → {formatDate(b.return_date)}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-medium text-white">{formatMYR(b.total_price)}</div>
                                <BookingStatusBadge status={b.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
