import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminCustomers, updateUserRole, getCustomerBookings, verifyCustomer, unverifyCustomer } from '../../hooks/useAdmin';
import AdminLayout from '../../components/AdminLayout';
import BookingStatusBadge from '../../components/BookingStatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';
import {
  Search, Users, Shield, ShieldOff, Mail, Phone, CalendarDays,
  ChevronDown, ChevronUp, X, AlertTriangle, CheckCircle, Clock, FileCheck, Wallet
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';

const ROLE_OPTIONS = ['ALL', 'customer', 'admin', 'super_admin'];

export default function Customers() {
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState(null);
  const [confirmRole, setConfirmRole] = useState(null);
  const [verifyChanging, setVerifyChanging] = useState(null);
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');
  const [deductingId, setDeductingId] = useState(null);

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
    if (customerId === user?.id) return;
    if (!isSuperAdmin) return; // Only super admins can change roles
    setRoleChanging(customerId);
    try {
      await updateUserRole(customerId, newRole, user.id);
      await refetch();
      setConfirmRole(null);
    } catch (err) {
      toast.error('Failed to update role: ' + err.message);
    } finally {
      setRoleChanging(null);
    }
  }

  async function handleVerifyToggle(customerId, currentlyVerified) {
    setVerifyChanging(customerId);
    try {
      if (currentlyVerified) {
        await unverifyCustomer(customerId, user.id);
        toast.success('Verification revoked');
      } else {
        await verifyCustomer(customerId, user.id);
        toast.success('Customer verified!');
      }
      await refetch();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setVerifyChanging(null);
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
                  customer.role === 'super_admin'
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : customer.role === 'admin'
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
                      customer.role === 'super_admin'
                        ? 'bg-amber-500/20 text-amber-300'
                        : customer.role === 'admin'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {customer.role === 'super_admin' ? 'SUPER ADMIN' : customer.role}
                    </span>
                    {customer.is_verified ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    ) : customer.ic_number ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : null}
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

                      {/* Role management - Super Admin only */}
                      {customer.id === user?.id ? (
                        <p className="text-xs text-slate-500 italic">Cannot change your own role</p>
                      ) : !isSuperAdmin ? (
                        <p className="text-xs text-slate-500 italic">Only Super Admins can manage roles</p>
                      ) : confirmRole?.id === customer.id ? (
                        <div className="glass-card !p-3 border border-yellow-500/20">
                          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="font-medium">Change role to: {confirmRole && confirmRole.newRole}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRoleChange(customer.id, confirmRole.newRole)}
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
                        <div className="space-y-2">
                          {customer.role !== 'super_admin' && (
                            <button
                              onClick={() => setConfirmRole({ id: customer.id, newRole: 'super_admin' })}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
                            >
                              <Shield className="w-4 h-4" /> Make Super Admin
                            </button>
                          )}
                          {customer.role !== 'admin' && (
                            <button
                              onClick={() => setConfirmRole({ id: customer.id, newRole: customer.role === 'super_admin' ? 'admin' : 'admin' })}
                              className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                customer.role === 'super_admin'
                                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                  : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20'
                              }`}
                            >
                              {customer.role === 'super_admin' ? (
                                <><ShieldOff className="w-4 h-4" /> Demote to Admin</>
                              ) : (
                                <><Shield className="w-4 h-4" /> Make Admin</>
                              )}
                            </button>
                          )}
                          {customer.role !== 'customer' && (
                            <button
                              onClick={() => setConfirmRole({ id: customer.id, newRole: 'customer' })}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                            >
                              <ShieldOff className="w-4 h-4" /> Remove All Admin Access
                            </button>
                          )}
                        </div>
                      )}

                      {/* Verification toggle */}
                      {customer.role !== 'admin' && (
                        <>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4">Verification</h4>
                          {customer.ic_number || customer.licence_number ? (
                            <div className="space-y-2">
                              <div className="text-xs text-slate-400 space-y-1">
                                {customer.ic_number && <p><span className="text-slate-500">IC:</span> {customer.ic_number}</p>}
                                {customer.licence_expiry && <p><span className="text-slate-500">Expiry:</span> {formatDate(customer.licence_expiry)}</p>}
                                {customer.phone && <p><span className="text-slate-500">Phone:</span> {customer.phone}</p>}
                                {customer.address_line1 && <p><span className="text-slate-500">Address:</span> {customer.address_line1}, {customer.city} {customer.state}</p>}
                              </div>
                              <button
                                onClick={() => handleVerifyToggle(customer.id, customer.is_verified)}
                                disabled={verifyChanging === customer.id}
                                className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                  customer.is_verified
                                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                                }`}
                              >
                                {verifyChanging === customer.id ? 'Updating...' : customer.is_verified ? (
                                  <><ShieldOff className="w-4 h-4" /> Revoke Verification</>
                                ) : (
                                  <><FileCheck className="w-4 h-4" /> Verify Customer</>
                                )}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No documents submitted yet</p>
                          )}
                        </>
                      )}

                      {/* Deposit Credit */}
                      {customer.role !== 'admin' && (
                        <>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4">Deposit Credit</h4>
                          <div className="flex items-center gap-2 mb-2">
                            <Wallet className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-white font-semibold">{formatMYR(customer.deposit_credit || 0)}</span>
                          </div>
                          <div className="space-y-2">
                            <input type="number" min="0" step="0.01" value={deductAmount}
                              onChange={e => setDeductAmount(e.target.value)}
                              className="input-field !py-1.5 text-xs" placeholder="Amount to deduct" />
                            <input type="text" value={deductReason}
                              onChange={e => setDeductReason(e.target.value)}
                              className="input-field !py-1.5 text-xs" placeholder="Reason (e.g. fine, damage)" />
                            <button
                              onClick={async () => {
                                if (!deductAmount || Number(deductAmount) <= 0) { toast.error('Enter a valid amount'); return; }
                                if (Number(deductAmount) > Number(customer.deposit_credit || 0)) { toast.error('Cannot deduct more than balance'); return; }
                                setDeductingId(customer.id);
                                try {
                                  const newCredit = Number(customer.deposit_credit || 0) - Number(deductAmount);
                                  const { error: upErr } = await supabase.from('bubatrent_booking_profiles')
                                    .update({ deposit_credit: newCredit }).eq('id', customer.id);
                                  if (upErr) throw upErr;
                                  await supabase.from('bubatrent_booking_credit_transactions').insert({
                                    user_id: customer.id,
                                    amount: -Number(deductAmount),
                                    type: 'deducted',
                                    description: deductReason || 'Admin deduction',
                                    admin_id: user.id,
                                  });
                                  toast.success(`Deducted ${formatMYR(deductAmount)}`);
                                  setDeductAmount(''); setDeductReason('');
                                  refetch();
                                } catch (err) { toast.error(err.message); }
                                finally { setDeductingId(null); }
                              }}
                              disabled={deductingId === customer.id}
                              className="flex items-center gap-1 w-full px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                            >
                              {deductingId === customer.id ? 'Deducting...' : 'Deduct Credit'}
                            </button>
                          </div>
                        </>
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
