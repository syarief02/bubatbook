import AdminLayout from '../../components/AdminLayout';
import { useAdminStats } from '../../hooks/useAdmin';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatMYR } from '../../utils/pricing';
import { CalendarDays, Car, DollarSign, FileCheck, TrendingUp, Users } from 'lucide-react';

export default function AdminDashboard() {
  const { stats, loading } = useAdminStats();

  if (loading) return <AdminLayout title="Dashboard"><LoadingSpinner /></AdminLayout>;

  const cards = [
    { label: 'Total Bookings', value: stats?.totalBookings || 0, icon: CalendarDays, color: 'violet' },
    { label: 'Active Bookings', value: stats?.activeBookings || 0, icon: TrendingUp, color: 'green' },
    { label: 'Fleet Size', value: stats?.totalCars || 0, icon: Car, color: 'indigo' },
    { label: 'Pending Verifications', value: stats?.pendingVerifications || 0, icon: FileCheck, color: 'yellow' },
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }, i) => (
          <div
            key={label}
            className="glass-card animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
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
        <a href="/admin/cars" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Car className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Manage Cars</p>
            <p className="text-xs text-slate-500">Add, edit, or remove cars from your fleet</p>
          </div>
        </a>
        <a href="/admin/bookings" className="glass-card glass-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <CalendarDays className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Manage Bookings</p>
            <p className="text-xs text-slate-500">View and update booking statuses</p>
          </div>
        </a>
      </div>
    </AdminLayout>
  );
}
