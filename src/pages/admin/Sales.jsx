import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { useFleet } from '../../hooks/useFleet';
import { formatMYR } from '../../utils/pricing';
import {
  BOOKED_STATUSES,
  depositHeld,
  depositReceived,
  rentalPaid,
  sumBy,
  chargesCollected,
  chargesOwed,
} from '../../utils/revenue';
import { DollarSign, TrendingUp, Car, Filter, Wallet, Wrench } from 'lucide-react';

// Static class names: Tailwind drops classes built at runtime like `bg-${color}-500/10`
const CARD_BG = {
  green: 'bg-green-500/10',
  yellow: 'bg-yellow-500/10',
  violet: 'bg-violet-500/10',
};
const CARD_TEXT = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  violet: 'text-violet-400',
  rose: 'text-rose-400',
};

export default function AdminSales() {
  const { activeFleetId } = useFleet();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function fetchData() {
    setLoading(true);
    let bQuery = supabase
      .from('bubatrent_booking_bookings')
      .select('*, bubatrent_booking_cars(id, name, brand, model)')
      .in('status', BOOKED_STATUSES)
      .order('created_at', { ascending: false });
    let cQuery = supabase.from('bubatrent_booking_cars').select('*');
    if (activeFleetId) {
      bQuery = bQuery.eq('fleet_group_id', activeFleetId);
      cQuery = cQuery.eq('fleet_group_id', activeFleetId);
    }
    const [{ data: bData }, { data: cData }] = await Promise.all([bQuery, cQuery]);
    setBookings(bData || []);
    setCars(cData || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFleetId]);

  // Periods are in the browser's local time (Malaysia), by booking date
  function getFilteredBookings() {
    const now = new Date();
    let from = null;
    let to = null;
    if (dateRange === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === 'custom' && startDate && endDate) {
      from = new Date(`${startDate}T00:00:00`);
      to = new Date(`${endDate}T23:59:59.999`);
    }
    return bookings.filter((b) => {
      const created = new Date(b.created_at);
      return (!from || created >= from) && (!to || created <= to);
    });
  }

  const filtered = getFilteredBookings();
  const rentalRevenue = sumBy(filtered, rentalPaid);
  const depositsReceived = sumBy(filtered, depositReceived);
  // Not limited to the period: what is held for running bookings today
  const depositsHeldNow = sumBy(bookings, depositHeld);
  const charges = sumBy(filtered, chargesCollected);
  const owed = sumBy(filtered, chargesOwed);

  // Per-car breakdown
  const carStats = cars
    .map((car) => {
      const carBookings = filtered.filter((b) => b.car_id === car.id);
      return {
        ...car,
        bookingCount: carBookings.length,
        rent: sumBy(carBookings, rentalPaid),
        deposits: sumBy(carBookings, depositReceived),
        charges: sumBy(carBookings, chargesCollected),
      };
    })
    .filter((c) => c.bookingCount > 0)
    .sort((a, b) => b.rent - a.rent);

  if (loading)
    return (
      <AdminLayout title="Sales">
        <LoadingSpinner />
      </AdminLayout>
    );

  return (
    <AdminLayout title="Sales Dashboard">
      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-slate-500" />
        {[
          ['all', 'All Time'],
          ['today', 'Today'],
          ['month', 'This Month'],
          ['custom', 'Custom'],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setDateRange(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRange === val ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            {label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field !py-1.5 !px-3 text-xs w-36"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field !py-1.5 !px-3 text-xs w-36"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {[
          {
            label: 'Rental Revenue',
            hint: 'Verified rental payments',
            value: rentalRevenue,
            icon: TrendingUp,
            color: 'green',
          },
          {
            label: 'Charges Collected',
            hint:
              owed > 0
                ? `Late return, damage… · ${formatMYR(owed)} still owed`
                : 'Late return, damage…',
            value: charges,
            icon: Wrench,
            color: 'rose',
          },
          {
            label: 'Deposits Received',
            hint: 'Refundable — not revenue',
            value: depositsReceived,
            icon: DollarSign,
            color: 'yellow',
          },
          {
            label: 'Deposits Held Now',
            hint: 'Running bookings, any date',
            value: depositsHeldNow,
            icon: Wallet,
            color: 'violet',
          },
        ].map(({ label, hint, value, icon: Icon, color }) => (
          <div key={label} className="glass-card">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl ${CARD_BG[color]} flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${CARD_TEXT[color]}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold text-white">{formatMYR(value)}</p>
                <p className="text-[11px] text-slate-600">{hint}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mb-8">
        Periods count bookings by the date they were made. Rental payments and charges are income;
        deposits go back to customers as credit after the rental, less any charges.
      </p>

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
                  <th className="pb-3 pr-4">Rental Revenue</th>
                  <th className="pb-3 pr-4">Charges</th>
                  <th className="pb-3">Deposits (refundable)</th>
                </tr>
              </thead>
              <tbody>
                {carStats.map((car) => (
                  <tr key={car.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 text-white font-medium">{car.name}</td>
                    <td className="py-3 pr-4 text-slate-400">{car.bookingCount}</td>
                    <td className="py-3 pr-4 text-green-400 font-semibold">
                      {formatMYR(car.rent)}
                    </td>
                    <td className="py-3 pr-4 text-rose-400">{formatMYR(car.charges)}</td>
                    <td className="py-3 text-yellow-400">{formatMYR(car.deposits)}</td>
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
