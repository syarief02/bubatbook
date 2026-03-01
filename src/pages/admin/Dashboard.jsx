import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminStats } from '../../hooks/useAdmin';
import { useFleet } from '../../hooks/useFleet';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatMYR } from '../../utils/pricing';
import { CalendarDays, Car, DollarSign, FileCheck, TrendingUp, Users, Receipt } from 'lucide-react';

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
  const { activeFleetId, activeFleet } = useFleet();
  const { stats, loading } = useAdminStats(activeFleetId);

  if (loading) return <AdminLayout title="Dashboard"><LoadingSpinner /></AdminLayout>;

  const cards = [
    { label: 'Total Bookings', value: stats?.totalBookings || 0, icon: CalendarDays, color: 'violet' },
    { label: 'Active Bookings', value: stats?.activeBookings || 0, icon: TrendingUp, color: 'green' },
    { label: 'Fleet Size', value: stats?.totalCars || 0, icon: Car, color: 'indigo' },
    { label: 'Pending Verifications', value: stats?.pendingVerifications || 0, icon: FileCheck, color: 'yellow' },
    { label: 'Registered Users', value: stats?.totalCustomers || 0, icon: Users, color: 'cyan' },
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }, i) => (
          <div
            key={label}
            className="glass-card animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${bgColorMap[color]} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${textColorMap[color]}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Card */}
      <div className="glass-card glow-sm mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Revenue (Deposits)</p>
            <p className="text-3xl font-bold gradient-text">{formatMYR(stats?.totalRevenue || 0)}</p>
          </div>
        </div>
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
