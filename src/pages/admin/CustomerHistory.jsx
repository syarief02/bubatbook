import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search, UserCheck } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { formatDate, getDaysDifference } from '../../utils/dates';
import { normalizePhone } from '../../utils/phoneUtils';
import { formatMYR } from '../../utils/pricing';
import { BOOKED_STATUSES, sumBy } from '../../utils/revenue';

// Every customer who has rented, with or without an account on the website.
// Bookings are grouped by phone number (so someone's WhatsApp rentals from
// before the website join their later online ones), then by account, then by
// name.

function useAllRentals(fleetId) {
  return useQuery({
    queryKey: ['customer-history', fleetId],
    queryFn: async () => {
      let query = supabase
        .from('bubatrent_booking_bookings')
        .select(
          'id, user_id, customer_name, customer_phone, customer_email, pickup_date, return_date, total_price, rent_paid, deposit_amount, status, bubatrent_booking_cars(id, name, plate_number)'
        )
        .in('status', BOOKED_STATUSES)
        .order('pickup_date', { ascending: false });
      if (fleetId) query = query.eq('fleet_group_id', fleetId);
      const { data: bookings, error } = await query;
      if (error) throw error;

      const userIds = [...new Set(bookings.map((b) => b.user_id).filter(Boolean))];
      let profiles = [];
      if (userIds.length) {
        const { data, error: pErr } = await supabase
          .from('bubatrent_booking_profiles')
          .select('id, display_name, phone')
          .in('id', userIds);
        if (pErr) throw pErr;
        profiles = data || [];
      }
      return { bookings, profiles };
    },
  });
}

function phoneKey(raw) {
  const p = normalizePhone(raw || '');
  return p.replace(/\D/g, '').length >= 9 ? p : null;
}

function groupCustomers(bookings, profiles) {
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const groups = new Map();
  for (const b of bookings) {
    const profile = b.user_id ? profileById[b.user_id] : null;
    const phone = phoneKey(b.customer_phone) || phoneKey(profile?.phone);
    const name = (b.customer_name || profile?.display_name || '').trim();
    const key = phone
      ? `p:${phone}`
      : b.user_id
        ? `u:${b.user_id}`
        : name
          ? `n:${name.toLowerCase()}`
          : `b:${b.id}`;
    if (!groups.has(key)) {
      groups.set(key, { key, phone, names: [], userId: null, bookings: [] });
    }
    const g = groups.get(key);
    g.bookings.push(b);
    if (name && !g.names.includes(name)) g.names.push(name);
    if (b.user_id) g.userId = b.user_id;
  }
  return [...groups.values()].map((g) => {
    const rent = sumBy(g.bookings, (b) => Number(b.total_price || 0));
    const paid = sumBy(g.bookings, (b) => Number(b.rent_paid || 0));
    return {
      ...g,
      // Bookings are newest first, so the first name is the latest one used
      name: g.names[0] || null,
      rentals: g.bookings.length,
      days: sumBy(g.bookings, (b) => getDaysDifference(b.pickup_date, b.return_date)),
      rent,
      paid,
      due: sumBy(g.bookings, (b) =>
        Math.max(Number(b.total_price || 0) - Number(b.rent_paid || 0), 0)
      ),
      last: g.bookings[0].pickup_date,
      cars: [
        ...new Set(
          g.bookings.map(
            (b) => b.bubatrent_booking_cars?.plate_number || b.bubatrent_booking_cars?.name
          )
        ),
      ].filter(Boolean),
    };
  });
}

const SORTS = {
  latest: { label: 'Latest rental', fn: (a, b) => b.last.localeCompare(a.last) },
  rentals: { label: 'Most rentals', fn: (a, b) => b.rentals - a.rentals || b.rent - a.rent },
  rent: { label: 'Most rent', fn: (a, b) => b.rent - a.rent },
  due: { label: 'Most owed', fn: (a, b) => b.due - a.due || b.last.localeCompare(a.last) },
};

export default function AdminCustomerHistory() {
  const { activeFleetId } = useFleet();
  const { data, isLoading, error } = useAllRentals(activeFleetId);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('latest');
  const [open, setOpen] = useState(null); // customer key

  const customers = useMemo(
    () => (data ? groupCustomers(data.bookings, data.profiles) : []),
    [data]
  );
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const shown = customers
    .filter(
      (c) =>
        !q ||
        c.names.some((n) => n.toLowerCase().includes(q)) ||
        (qDigits.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(qDigits)) ||
        c.cars.some((p) => p.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    )
    .sort(SORTS[sort].fn);

  return (
    <AdminLayout title="Customer History">
      <p className="text-sm text-slate-400 mb-6">
        Everyone who has rented, with or without an account: their rentals, what they paid and what
        they still owe. Rentals with the same phone number are counted as one customer.
      </p>

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="glass-card text-center">
          <p className="text-red-400">{error.message}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              ['Customers', customers.length],
              ['Came back', customers.filter((c) => c.rentals > 1).length],
              ['Without an account', customers.filter((c) => !c.userId).length],
              ['Still owed', formatMYR(sumBy(customers, (c) => c.due))],
            ].map(([label, value]) => (
              <div key={label} className="glass-card !p-3">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="text-lg font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone or plate..."
                className="input-field !pl-10"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-field sm:w-44"
            >
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <div className="glass-card text-center">
              <p className="text-sm text-slate-500">No customers match.</p>
            </div>
          ) : (
            <div className="glass-card !p-0 divide-y divide-white/5">
              {shown.map((c) => (
                <div key={c.key}>
                  <button
                    onClick={() => setOpen(open === c.key ? null : c.key)}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    {open === c.key ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white flex items-center gap-2 flex-wrap">
                        {c.name || c.phone || 'Unknown customer'}
                        {c.userId ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Account
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                            No account
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[
                          c.name && c.phone,
                          c.names.length > 1 && `also: ${c.names.slice(1).join(', ')}`,
                          `${c.rentals} rental${c.rentals === 1 ? '' : 's'} · ${c.days} days`,
                          c.cars.join(', '),
                          `last ${formatDate(c.last)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-white">{formatMYR(c.rent)}</p>
                      {c.due > 0 && (
                        <p className="text-[11px] text-amber-300">{formatMYR(c.due)} owed</p>
                      )}
                    </div>
                  </button>

                  {open === c.key && (
                    <div className="px-3 pb-3 pl-10 space-y-1">
                      {c.userId && (
                        <Link
                          to={`/admin/customers?search=${encodeURIComponent(c.name || '')}`}
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          Open their account in Customers →
                        </Link>
                      )}
                      {c.bookings.map((b) => {
                        const owed = Math.max(
                          Number(b.total_price || 0) - Number(b.rent_paid || 0),
                          0
                        );
                        return (
                          <Link
                            key={b.id}
                            to={`/admin/bookings/${b.id}`}
                            className="flex justify-between gap-3 text-xs rounded-lg bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2"
                          >
                            <span className="text-slate-300">
                              {formatDate(b.pickup_date)} – {formatDate(b.return_date)}
                              <span className="text-slate-500">
                                {' '}
                                ·{' '}
                                {b.bubatrent_booking_cars?.plate_number ||
                                  b.bubatrent_booking_cars?.name}
                                {b.customer_name && b.customer_name !== c.name
                                  ? ` · ${b.customer_name}`
                                  : ''}
                              </span>
                            </span>
                            <span className="shrink-0">
                              <span className="text-white">{formatMYR(b.total_price)}</span>
                              <span className={owed > 0 ? 'text-amber-300' : 'text-green-400'}>
                                {owed > 0 ? ` · ${formatMYR(owed)} owed` : ' · paid'}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
