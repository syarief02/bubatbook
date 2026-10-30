import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, FileBadge, FileImage, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SignedLink } from '../../components/SignedFile';
import { supabase } from '../../lib/supabase';
import { DOC_LABELS } from '../../utils/carDocuments';
import { formatDate, getDaysDifference } from '../../utils/dates';
import { formatMYR } from '../../utils/pricing';
import {
  BOOKED_STATUSES,
  chargesCollected,
  expensePaid,
  rentalPaidForCar,
  sumBy,
} from '../../utils/revenue';

// One car's history: its rentals (with customer and payment), expenses and
// document renewals in date order, with the year's totals on top. The totals
// follow the Sales page: rent received + charges - paid expenses. Renewals
// another fleet recorded before the car moved are listed without their cost.

function useCarHistory(carId) {
  return useQuery({
    queryKey: ['car-history', carId],
    queryFn: async () => {
      const [car, bookings, claims, docs, shared] = await Promise.all([
        supabase.from('bubatrent_booking_cars').select('*').eq('id', carId).maybeSingle(),
        supabase
          .from('bubatrent_booking_bookings')
          .select(
            'id, status, customer_name, customer_phone, pickup_date, return_date, total_price, deposit_amount, deposit_status, deposit_credited_at, rent_paid, charges_total, amount_owed, full_payment_status, notes, car_id, bubatrent_booking_rental_changes(kind, from_car_id, to_car_id, change_date, created_at)'
          )
          .eq('car_id', carId)
          .in('status', BOOKED_STATUSES),
        supabase
          .from('bubatrent_booking_expense_claims')
          .select(
            'id, title, description, category, total_amount, expense_date, status, payment_receipt_path, bubatrent_booking_expense_images(file_path)'
          )
          .eq('car_id', carId),
        supabase
          .from('bubatrent_booking_car_documents')
          .select('id, doc_type, valid_from, valid_until, amount, created_at')
          .eq('car_id', carId),
        // Documents a fleet you aren't in recorded before the car moved to yours
        supabase.rpc('bubatrent_admin_shared_car_documents', { p_fleet_group_id: null }),
      ]);
      for (const r of [car, bookings, claims, docs, shared]) if (r.error) throw r.error;
      return {
        car: car.data,
        bookings: bookings.data,
        claims: claims.data,
        docs: [
          ...docs.data,
          ...(shared.data || [])
            .filter((d) => d.car_id === carId)
            .map((d) => ({ ...d, shared: true, amount: null })),
        ],
      };
    },
  });
}

function rentStatus(b) {
  const total = Number(b.total_price || 0);
  const paid = Number(b.rent_paid || 0);
  if (paid >= total) return { label: 'Paid', className: 'text-green-400' };
  if (paid > 0)
    return { label: `${formatMYR(total - paid)} still due`, className: 'text-amber-300' };
  return { label: 'Unpaid', className: 'text-red-400' };
}

export default function AdminCarHistory() {
  const { carId } = useParams();
  const { data, isLoading, error } = useCarHistory(carId);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { years, items, totals } = useMemo(() => {
    if (!data) return { years: [], items: [], totals: null };
    const all = [
      ...data.bookings.map((b) => ({ type: 'rental', date: b.pickup_date, b })),
      ...data.claims.map((c) => ({ type: 'expense', date: c.expense_date, c })),
      ...data.docs.map((d) => ({
        type: 'document',
        date: d.valid_from || String(d.created_at).slice(0, 10),
        d,
      })),
    ].filter((i) => i.date);
    const yearList = [...new Set(all.map((i) => i.date.slice(0, 4)))].sort().reverse();
    const shown = all
      .filter((i) => year === 'all' || i.date.startsWith(year))
      .sort((a, b) => b.date.localeCompare(a.date));
    const rentals = shown.filter((i) => i.type === 'rental').map((i) => i.b);
    const claims = shown.filter((i) => i.type === 'expense').map((i) => i.c);
    const rent = sumBy(rentals, (b) => rentalPaidForCar(b, carId));
    const charges = sumBy(rentals, chargesCollected);
    const expenses = sumBy(claims, expensePaid);
    return {
      years: yearList,
      items: shown,
      totals: {
        rentals: rentals.length,
        days: sumBy(rentals, (b) => getDaysDifference(b.pickup_date, b.return_date)),
        rent,
        due: sumBy(rentals, (b) =>
          Math.max(Number(b.total_price || 0) - Number(b.rent_paid || 0), 0)
        ),
        expenses,
        profit: rent + charges - expenses,
      },
    };
  }, [data, year, carId]);

  if (isLoading)
    return (
      <AdminLayout title="Vehicle History">
        <LoadingSpinner />
      </AdminLayout>
    );
  if (error || !data?.car)
    return (
      <AdminLayout title="Vehicle History">
        <div className="glass-card text-center">
          <p className="text-red-400">{error?.message || 'Car not found.'}</p>
        </div>
      </AdminLayout>
    );

  const { car } = data;
  // Group the timeline by month, newest first
  const months = [];
  for (const item of items) {
    const key = item.date.slice(0, 7);
    if (months[months.length - 1]?.key !== key) months.push({ key, items: [] });
    months[months.length - 1].items.push(item);
  }

  return (
    <AdminLayout title="Vehicle History">
      <Link
        to="/admin/cars"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Cars
      </Link>

      <div className="glass-card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-white font-semibold text-lg truncate">{car.name}</h2>
            {car.plate_number && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 shrink-0">
                {car.plate_number}
              </span>
            )}
          </div>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="input-field !py-1.5 text-sm sm:w-36"
          >
            {[...new Set([String(new Date().getFullYear()), ...years])].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            <option value="all">All years</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          {[
            ['Rentals', `${totals.rentals} · ${totals.days} days`],
            ['Rent received', formatMYR(totals.rent)],
            ['Rent still due', formatMYR(totals.due)],
            ['Expenses', formatMYR(totals.expenses)],
            ['Profit', formatMYR(totals.profit)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white/[0.03] rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p
                className={`text-sm font-semibold ${
                  label === 'Profit'
                    ? totals.profit < 0
                      ? 'text-red-400'
                      : 'text-emerald-400'
                    : label === 'Rent still due' && totals.due > 0
                      ? 'text-amber-300'
                      : 'text-white'
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Rentals count in the month they start. Expenses include loan instalments and running costs
          recorded in Expenses.
        </p>
      </div>

      {months.length === 0 ? (
        <div className="glass-card text-center">
          <p className="text-sm text-slate-500">Nothing recorded for this car in {year}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {months.map((m) => (
            <div key={m.key}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {format(parseISO(`${m.key}-01`), 'MMMM yyyy')}
              </p>
              <div className="glass-card !p-0 divide-y divide-white/5">
                {m.items.map((item) => (
                  <TimelineItem
                    key={`${item.type}-${(item.b || item.c || item.d).id}`}
                    item={item}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function TimelineItem({ item }) {
  if (item.type === 'rental') {
    const { b } = item;
    const status = rentStatus(b);
    const days = getDaysDifference(b.pickup_date, b.return_date);
    return (
      <Link
        to={`/admin/bookings/${b.id}`}
        className="flex items-start gap-3 p-3 hover:bg-white/[0.03] transition-colors"
      >
        <CalendarDays className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            {formatDate(b.pickup_date)} – {formatDate(b.return_date)}
            <span className="text-slate-400">
              {' '}
              · {days} day{days === 1 ? '' : 's'} · {b.customer_name || 'Customer'}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            {b.customer_phone && `${b.customer_phone} · `}
            {Number(b.deposit_amount) > 0 &&
              `Deposit ${formatMYR(b.deposit_amount)}${b.deposit_credited_at ? ' (returned)' : ''} · `}
            <span className={status.className}>{status.label}</span>
          </p>
        </div>
        <span className="text-sm font-medium text-emerald-400 shrink-0">
          {formatMYR(b.total_price)}
        </span>
      </Link>
    );
  }
  if (item.type === 'expense') {
    const { c } = item;
    const files = [
      c.payment_receipt_path,
      ...(c.bubatrent_booking_expense_images || []).map((i) => i.file_path),
    ].filter((p, i, a) => p && a.indexOf(p) === i);
    return (
      <div className="flex items-start gap-3 p-3">
        <Receipt className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            {c.category || 'Expense'}
            <span className="text-slate-400"> · {c.title || c.description}</span>
          </p>
          <p className="text-xs text-slate-500 flex flex-wrap gap-x-3">
            <span>{formatDate(c.expense_date)}</span>
            {c.status !== 'completed' && <span className="text-amber-300">Not paid yet</span>}
            {files.map((p, i) => (
              <SignedLink
                key={p}
                path={p}
                className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
              >
                <FileImage className="w-3 h-3" /> Receipt{files.length > 1 ? ` ${i + 1}` : ''}
              </SignedLink>
            ))}
          </p>
        </div>
        <span className="text-sm font-medium text-red-400 shrink-0">
          −{formatMYR(c.total_amount)}
        </span>
      </div>
    );
  }
  const { d } = item;
  return (
    <Link
      to="/admin/car-documents"
      className="flex items-start gap-3 p-3 hover:bg-white/[0.03] transition-colors"
    >
      <FileBadge className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">
          {DOC_LABELS[d.doc_type]} renewed
          <span className="text-slate-400"> · valid until {formatDate(d.valid_until)}</span>
          {d.shared && <span className="text-slate-500"> · recorded by {d.fleet_name}</span>}
        </p>
      </div>
      {d.amount != null && (
        <span className="text-xs text-slate-500 shrink-0">{formatMYR(d.amount)}</span>
      )}
    </Link>
  );
}
