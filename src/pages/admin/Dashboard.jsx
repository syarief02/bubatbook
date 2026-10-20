import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminCars, useAdminStats, useCarDocuments } from '../../hooks/useAdmin';
import { useFleet } from '../../hooks/useFleet';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatMYR } from '../../utils/pricing';
import { DUE_SOON_DAYS, documentAlerts } from '../../utils/carDocuments';
import {
  CalendarDays,
  Car,
  DollarSign,
  FileCheck,
  TrendingUp,
  UserCheck,
  Users,
  Receipt,
  Bell,
  ChevronRight,
} from 'lucide-react';

// Static color maps — dynamic template literals like `bg-${color}-500/10`
// get purged by Tailwind in production builds.
const bgColorMap = {
  violet: 'bg-violet-500/10',
  green: 'bg-green-500/10',
  indigo: 'bg-indigo-500/10',
  yellow: 'bg-yellow-500/10',
  cyan: 'bg-cyan-500/10',
};
const textColorMap = {
  violet: 'text-violet-400',
  green: 'text-green-400',
  indigo: 'text-indigo-400',
  yellow: 'text-yellow-400',
  cyan: 'text-cyan-400',
};

export default function AdminDashboard() {
  const { activeFleetId } = useFleet();
  const { stats, loading } = useAdminStats(activeFleetId);
  const { cars } = useAdminCars(activeFleetId);
  const { documents } = useCarDocuments(activeFleetId);

  if (loading)
    return (
      <AdminLayout title="Dashboard">
        <LoadingSpinner />
      </AdminLayout>
    );

  const cards = [
    {
      label: 'Total Bookings',
      value: stats?.totalBookings || 0,
      icon: CalendarDays,
      color: 'violet',
    },
    {
      label: 'Active Bookings',
      value: stats?.activeBookings || 0,
      icon: TrendingUp,
      color: 'green',
    },
    { label: 'Fleet Size', value: stats?.totalCars || 0, icon: Car, color: 'indigo' },
    {
      label: 'Customers to Verify',
      value: stats?.pendingVerifications || 0,
      icon: UserCheck,
      color: 'yellow',
      to: '/admin/customers?verification=pending',
    },
    {
      label: 'Deposits to Check',
      value: stats?.depositsToReview || 0,
      icon: FileCheck,
      color: 'yellow',
      to: '/admin/bookings?status=DEPOSIT_PAID',
    },
    { label: 'Registered Users', value: stats?.totalCustomers || 0, icon: Users, color: 'cyan' },
  ];

  // Things waiting for an admin; the panel shows only when something is waiting
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  // Road tax, insurance, Puspakom or GPS of a car: expired, or due soon
  const docAlerts = documentAlerts(cars, documents);
  const expiredDocs = docAlerts.filter((a) => a.status === 'expired');
  const dueDocs = docAlerts.filter((a) => a.status === 'due_soon');
  const plates = (list) =>
    [...new Set(list.map((a) => a.car.plate_number || a.car.name))].join(', ');
  const todo = [
    stats?.depositsToReview > 0 && {
      label: `${plural(stats.depositsToReview, 'deposit receipt')} to check`,
      detail: 'Online deposits are released after 48 hours',
      to: '/admin/bookings?status=DEPOSIT_PAID',
    },
    expiredDocs.length > 0 && {
      label: `${plural(expiredDocs.length, 'car document')} expired: ${plates(expiredDocs)}`,
      detail: 'Renew, or keep the car off the road',
      to: '/admin/car-documents',
    },
    dueDocs.length > 0 && {
      label: `${plural(dueDocs.length, 'car document')} expiring within ${DUE_SOON_DAYS} days: ${plates(dueDocs)}`,
      detail: 'Road tax, insurance, Puspakom or GPS',
      to: '/admin/car-documents',
    },
    stats?.depositsOnHold > 0 && {
      label: `${plural(stats.depositsOnHold, 'deposit')} on hold to settle (${formatMYR(stats.depositsOnHoldAmount)})`,
      detail: 'Returned cars waiting for the damage cost',
      to: '/admin/bookings?deposit=held',
    },
    stats?.customersWithCredit > 0 && {
      label: `${formatMYR(stats.creditOwed)} credit owed to ${plural(stats.customersWithCredit, 'customer')}`,
      detail: 'Refund by transfer, or keep for their next booking',
      to: '/admin/customers?credit=1',
    },
    stats?.renewalsToReview > 0 && {
      label: `${plural(stats.renewalsToReview, 'licence renewal')} to review`,
      detail: 'Customers can book again once you approve',
      to: '/admin/customers?verification=renewal',
    },
    stats?.pendingVerifications > 0 && {
      label: `${plural(stats.pendingVerifications, 'customer')} to verify`,
      detail: 'Waiting for you to check their documents',
      to: '/admin/customers?verification=pending',
    },
  ].filter(Boolean);

  return (
    <AdminLayout title="Dashboard">
      {/* Needs your attention */}
      {todo.length > 0 && (
        <div className="glass-card mb-8 border-amber-500/20 bg-amber-500/5">
          <h2 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Needs your attention
          </h2>
          <div className="divide-y divide-white/5">
            {todo.map(({ label, detail, to }) => (
              <Link
                key={label}
                to={to}
                className="flex items-center justify-between gap-3 py-2.5 group"
              >
                <span className="text-sm text-slate-200 group-hover:text-white">{label}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1 text-right">
                  <span className="hidden sm:inline">{detail}</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, to }, i) => {
          const Card = to ? Link : 'div';
          return (
            <Card
              key={label}
              {...(to ? { to } : {})}
              className={`glass-card animate-fade-in ${to ? 'glass-card-hover' : ''}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl ${bgColorMap[color]} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${textColorMap[color]}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </Card>
          );
        })}
      </div>

      {/* Revenue Card */}
      <div className="glass-card glow-sm mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Rental Revenue (verified rental payments)</p>
            <p className="text-3xl font-bold gradient-text">
              {formatMYR(stats?.rentalRevenue || 0)}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Deposits held now: {formatMYR(stats?.depositsHeld || 0)} — not revenue; each goes back to
          the customer&apos;s credit when the car is returned, less any charges.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Charges after rentals (late return, damage…) collected:{' '}
          {formatMYR(stats?.chargesCollected || 0)}
          {stats?.chargesOwed > 0 && (
            <span className="text-red-400">
              {' '}
              · still owed by customers: {formatMYR(stats.chargesOwed)}
            </span>
          )}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/admin/cars" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Car className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Manage Cars</p>
            <p className="text-xs text-slate-500">Add, edit, or remove cars from your fleet</p>
          </div>
        </Link>
        <Link to="/admin/bookings" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <CalendarDays className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Manage Bookings</p>
            <p className="text-xs text-slate-500">View and update booking statuses</p>
          </div>
        </Link>
        <Link to="/admin/customers" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Manage Customers</p>
            <p className="text-xs text-slate-500">View users, roles, and booking history</p>
          </div>
        </Link>
        <Link to="/admin/sales" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Sales</p>
            <p className="text-xs text-slate-500">View revenue breakdown and per-car sales</p>
          </div>
        </Link>
        <Link to="/admin/expenses" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Expenses</p>
            <p className="text-xs text-slate-500">Manage expense claims and invoices</p>
          </div>
        </Link>
      </div>
    </AdminLayout>
  );
}
