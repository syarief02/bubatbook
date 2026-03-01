import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { formatMYR } from '../../utils/pricing';
import { formatDate } from '../../utils/dates';
import { DollarSign, TrendingUp, Car, Calendar, Filter } from 'lucide-react';

export default function AdminSales() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: bData }, { data: cData }] = await Promise.all([
      supabase.from('bubatrent_booking_bookings')
        .select('*, bubatrent_booking_cars(id, name, brand, model)')
        .in('status', ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'RETURNED', 'PAID'])
        .order('created_at', { ascending: false }),
      supabase.from('bubatrent_booking_cars').select('*'),
    ]);
    setBookings(bData || []);
    setCars(cData || []);
    setLoading(false);
  }

  function getFilteredBookings() {
    let filtered = bookings;
    const now = new Date();
    if (dateRange === 'today') {
      const today = now.toISOString().split('T')[0];
      filtered = filtered.filter(b => b.created_at?.startsWith(today));
    } else if (dateRange === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      filtered = filtered.filter(b => b.created_at >= monthStart);
    } else if (dateRange === 'custom' && startDate && endDate) {
      filtered = filtered.filter(b => b.created_at >= startDate && b.created_at <= endDate + 'T23:59:59');
    }
    return filtered;
  }

  const filtered = getFilteredBookings();
  const totalDeposits = filtered.reduce((s, b) => s + Number(b.deposit_amount || 0), 0);
  const totalFullPayments = filtered.filter(b => b.full_payment_status === 'verified')
    .reduce((s, b) => s + Number(b.full_payment_amount || b.total_price || 0), 0);
  const totalCashIn = totalDeposits + totalFullPayments;

  // Per-car breakdown
  const carStats = cars.map(car => {
    const carBookings = filtered.filter(b => b.car_id === car.id);
    const deposits = carBookings.reduce((s, b) => s + Number(b.deposit_amount || 0), 0);
    const payments = carBookings.filter(b => b.full_payment_status === 'verified')
      .reduce((s, b) => s + Number(b.full_payment_amount || b.total_price || 0), 0);
    return { ...car, bookingCount: carBookings.length, deposits, payments, total: deposits + payments };
  }).filter(c => c.bookingCount > 0).sort((a, b) => b.total - a.total);

  if (loading) return <AdminLayout title="Sales"><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout title="Sales Dashboard">
      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-slate-500" />
        {[['all','All Time'],['today','Today'],['month','This Month'],['custom','Custom']].map(([val, label]) => (
          <button key={val} onClick={() => setDateRange(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRange === val ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
            {label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field !py-1.5 !px-3 text-xs w-36" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field !py-1.5 !px-3 text-xs w-36" />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Deposits', value: totalDeposits, icon: DollarSign, color: 'yellow' },
          { label: 'Total Full Payments', value: totalFullPayments, icon: TrendingUp, color: 'green' },
          { label: 'Total Cash-In', value: totalCashIn, icon: DollarSign, color: 'violet' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold text-white">{formatMYR(value)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-Car Breakdown */}
      <div className="glass-card">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Car className="w-4 h-4" /> Revenue Per Car
        </h2>
        {carStats.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No bookings in selected period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/5">
                  <th className="pb-3 pr-4">Car</th>
                  <th className="pb-3 pr-4">Bookings</th>
                  <th className="pb-3 pr-4">Deposits</th>
                  <th className="pb-3 pr-4">Payments</th>
                  <th className="pb-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {carStats.map(car => (
                  <tr key={car.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 text-white font-medium">{car.name}</td>
                    <td className="py-3 pr-4 text-slate-400">{car.bookingCount}</td>
                    <td className="py-3 pr-4 text-yellow-400">{formatMYR(car.deposits)}</td>
                    <td className="py-3 pr-4 text-green-400">{formatMYR(car.payments)}</td>
                    <td className="py-3 text-white font-semibold">{formatMYR(car.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
