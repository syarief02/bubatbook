import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { useFleet } from '../../hooks/useFleet';
import { formatMYR } from '../../utils/pricing';
import { periodRange, inPeriod } from '../../utils/dates';
import {
  BOOKED_STATUSES,
  depositHeld,
  depositReceived,
  rentalPaid,
  rentalPaidForCar,
  rentShares,
  sumBy,
  chargesCollected,
  chargesOwed,
  expensePaid,
  expensePending,
} from '../../utils/revenue';
import {
  DollarSign,
  TrendingUp,
  Car,
  Filter,
  Wallet,
  Wrench,
  Receipt,
  PiggyBank,
} from 'lucide-react';

// Static class names: Tailwind drops classes built at runtime like `bg-${color}-500/10`
const CARD_BG = {
  green: 'bg-green-500/10',
  yellow: 'bg-yellow-500/10',
  violet: 'bg-violet-500/10',
  rose: 'bg-rose-500/10',
  red: 'bg-red-500/10',
  emerald: 'bg-emerald-500/10',
};
const CARD_TEXT = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  violet: 'text-violet-400',
  rose: 'text-rose-400',
  red: 'text-red-400',
  emerald: 'text-emerald-400',
};

export default function AdminSales() {
  const { activeFleetId } = useFleet();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [claims, setClaims] = useState([]);
  const [cars, setCars] = useState([]);
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function fetchData() {
    setLoading(true);
    let bQuery = supabase
      .from('bubatrent_booking_bookings')
      .select(
        '*, bubatrent_booking_cars(id, name, brand, model), bubatrent_booking_rental_changes(kind, from_car_id, to_car_id, change_date, created_at)'
      )
      .in('status', BOOKED_STATUSES)
      .order('created_at', { ascending: false });
    let cQuery = supabase.from('bubatrent_booking_cars').select('*');
    let eQuery = supabase
      .from('bubatrent_booking_expense_claims')
      .select('id, car_id, status, total_amount, expense_date');
    if (activeFleetId) {
      bQuery = bQuery.eq('fleet_group_id', activeFleetId);
      cQuery = cQuery.eq('fleet_group_id', activeFleetId);
      eQuery = eQuery.eq('fleet_group_id', activeFleetId);
    }
    const [{ data: bData }, { data: cData }, { data: eData }] = await Promise.all([
      bQuery,
      cQuery,
      eQuery,
    ]);
    setBookings(bData || []);
    setCars(cData || []);
    setClaims(eData || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFleetId]);

  // A rental counts in the period of its pickup date; an expense by its
  // expense date (Malaysia calendar days)
  const period = periodRange(dateRange, startDate, endDate);
  const filtered = bookings.filter((b) => inPeriod(b.pickup_date, period));
  const filteredClaims = claims.filter((c) => inPeriod(c.expense_date, period));
  const rentalRevenue = sumBy(filtered, rentalPaid);
  const depositsReceived = sumBy(filtered, depositReceived);
  // Not limited to the period: what is held for running bookings today
  const depositsHeldNow = sumBy(bookings, depositHeld);
  const charges = sumBy(filtered, chargesCollected);
  const owed = sumBy(filtered, chargesOwed);
  const expenses = sumBy(filteredClaims, expensePaid);
  const expensesPending = sumBy(filteredClaims, expensePending);
  const profit = rentalRevenue + charges - expenses;
  const generalExpenses = sumBy(
    filteredClaims.filter((c) => !c.car_id),
    expensePaid
  );

  // Per-car breakdown: cars with bookings or paid expenses in the period. A
  // rental whose car was replaced is split between the cars by days; its
  // deposit and charges stay with the car it ended on.
  const carStats = cars
    .map((car) => {
      const carBookings = filtered.filter((b) => rentShares(b).some((s) => s.carId === car.id));
      const endedHere = filtered.filter((b) => b.car_id === car.id);
      const rent = sumBy(carBookings, (b) => rentalPaidForCar(b, car.id));
      const carCharges = sumBy(endedHere, chargesCollected);
      const carExpenses = sumBy(
        filteredClaims.filter((c) => c.car_id === car.id),
        expensePaid
      );
      return {
        ...car,
        bookingCount: carBookings.length,
        rent,
        deposits: sumBy(endedHere, depositReceived),
        charges: carCharges,
        expenses: carExpenses,
        profit: rent + carCharges - carExpenses,
      };
    })
    .filter((c) => c.bookingCount > 0 || c.expenses > 0)
    .sort((a, b) => b.profit - a.profit);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
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
            label: 'Expenses Paid',
            hint:
              expensesPending > 0
                ? `Completed claims · ${formatMYR(expensesPending)} waiting`
                : 'Completed expense claims',
            value: expenses,
            icon: Receipt,
            color: 'red',
          },
          {
            label: 'Profit',
            hint: 'Rental revenue + charges − expenses',
            value: profit,
            icon: PiggyBank,
            color: 'emerald',
          },
          {
            label: 'Deposits Received',
            hint: 'Refundable — not revenue; credit reused not counted',
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
        Periods count rentals by their pickup date, and expenses by the expense date. Rental
        payments and charges are income; deposits go back to customers as credit after the rental,
        less any charges.
      </p>

      {/* Per-Car Breakdown */}
      <div className="glass-card">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Car className="w-4 h-4" /> Revenue and Expenses Per Car
        </h2>
        {carStats.length === 0 && generalExpenses === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No bookings or expenses in selected period
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/5">
                  <th className="pb-3 pr-4">Car</th>
                  <th className="pb-3 pr-4">Bookings</th>
                  <th className="pb-3 pr-4">Rental Revenue</th>
                  <th className="pb-3 pr-4">Charges</th>
                  <th className="pb-3 pr-4">Expenses</th>
                  <th className="pb-3 pr-4">Profit</th>
                  <th className="pb-3">Deposits (refundable)</th>
                </tr>
              </thead>
              <tbody>
                {carStats.map((car) => (
                  <tr key={car.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 text-white font-medium">
                      {car.name}
                      {car.plate_number && (
                        <span className="block text-[11px] text-slate-500 font-normal">
                          {car.plate_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{car.bookingCount}</td>
                    <td className="py-3 pr-4 text-green-400 font-semibold">
                      {formatMYR(car.rent)}
                    </td>
                    <td className="py-3 pr-4 text-rose-400">{formatMYR(car.charges)}</td>
                    <td className="py-3 pr-4 text-red-400">{formatMYR(car.expenses)}</td>
                    <td
                      className={`py-3 pr-4 font-semibold ${car.profit < 0 ? 'text-red-400' : 'text-emerald-400'}`}
                    >
                      {formatMYR(car.profit)}
                    </td>
                    <td className="py-3 text-yellow-400">{formatMYR(car.deposits)}</td>
                  </tr>
                ))}
                {generalExpenses > 0 && (
                  <tr className="border-b border-white/[0.03]">
                    <td className="py-3 pr-4 text-slate-300">Others (General)</td>
                    <td className="py-3 pr-4 text-slate-500">—</td>
                    <td className="py-3 pr-4 text-slate-500">—</td>
                    <td className="py-3 pr-4 text-slate-500">—</td>
                    <td className="py-3 pr-4 text-red-400">{formatMYR(generalExpenses)}</td>
                    <td className="py-3 pr-4 text-red-400 font-semibold">
                      {formatMYR(-generalExpenses)}
                    </td>
                    <td className="py-3 text-slate-500">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
