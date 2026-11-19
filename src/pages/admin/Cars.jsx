import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../components/AdminLayout';
import {
  useAdminCars,
  useCarDocuments,
  useFleetContacts,
  createCar,
  updateCar,
  deleteCar,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useFleet } from '../../hooks/useFleet';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { calculatePrice, carLongRentalRates, formatMYR, packageLines } from '../../utils/pricing';
import { DOC_LABELS, documentAlerts } from '../../utils/carDocuments';
import { formatDate } from '../../utils/dates';
import { friendlyDbError } from '../../utils/dbErrors';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Car,
  Loader2,
  History,
  Image as ImageIcon,
  MessageCircle,
  Truck,
} from 'lucide-react';

const EMPTY_CAR = {
  name: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  transmission: 'Auto',
  seats: 5,
  fuel_type: 'Petrol',
  price_per_day: 150,
  deposit_amount: 0,
  image_url: '',
  plate_number: '',
  features: [],
  is_available: true,
  // Commercial vehicle: online bookings need a GDL valid until the return date
  requires_gdl: false,
  contact_admin_id: null,
  // Long-term bookings on, with the fleet's discounts (null = the fleet's)
  long_rental_enabled: true,
  weekly_discount_pct: null,
  monthly_discount_pct: null,
  // Package prices instead of discounts (null = discounts), longest rental, fixed deposit
  rate_packages: null,
  max_rental_days: null,
  fixed_deposit: null,
};

export default function AdminCars() {
  const toast = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { activeFleetId, activeFleet, fleets } = useFleet();
  const { cars, loading, error, refetch } = useAdminCars(activeFleetId);
  const { documents } = useCarDocuments(activeFleetId);
  const { contacts } = useFleetContacts(activeFleetId);
  const docAlerts = documentAlerts(cars, documents);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CAR);
  const [saving, setSaving] = useState(false);
  const [featuresInput, setFeaturesInput] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fleetOf = (fleetId) => fleets.find((f) => f.id === fleetId) || null;

  // Close modal on Escape key
  useEffect(() => {
    if (!showForm) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setShowForm(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  function openNew() {
    setEditing(null);
    // A car you add is yours to answer on WhatsApp unless you pick someone else
    const mine = contacts.some((c) => c.user_id === user?.id);
    setForm({ ...EMPTY_CAR, contact_admin_id: mine ? user.id : null });
    setFeaturesInput('');
    setShowForm(true);
  }

  function openEdit(car) {
    setEditing(car.id);
    setForm({ ...car });
    setFeaturesInput((car.features || []).join(', '));
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const weekly = discountValue(form.weekly_discount_pct);
    const monthly = discountValue(form.monthly_discount_pct);
    if ([weekly, monthly].some((pct) => pct !== null && !(pct >= 0 && pct <= 90))) {
      toast.error('Long-term discounts must be between 0% and 90%.');
      return;
    }
    // Packages: every row needs whole days (2–365) and a price, each length once
    let packages = null;
    if (Array.isArray(form.rate_packages)) {
      const rows = form.rate_packages.filter((p) => Number(p.days) !== 1);
      const bad = rows.find(
        (p) =>
          !Number.isInteger(Number(p.days)) ||
          Number(p.days) < 2 ||
          Number(p.days) > 365 ||
          !(Number(p.total) > 0)
      );
      if (bad) {
        toast.error('Each package needs a number of days (2 to 365) and a price.');
        return;
      }
      const clean = cleanPackages(form);
      if (new Set(clean.map((p) => p.days)).size !== clean.length) {
        toast.error('Two packages have the same number of days.');
        return;
      }
      packages = clean.length ? [{ days: 1, total: Number(form.price_per_day) }, ...clean] : null;
    }
    const maxDays =
      form.max_rental_days === '' || form.max_rental_days == null
        ? null
        : Number(form.max_rental_days);
    if (maxDays !== null && !(Number.isInteger(maxDays) && maxDays >= 1 && maxDays <= 365)) {
      toast.error('The longest rental must be 1 to 365 days, or blank for no limit.');
      return;
    }
    const fixedDeposit =
      form.fixed_deposit === '' || form.fixed_deposit == null ? null : Number(form.fixed_deposit);
    if (fixedDeposit !== null && !(fixedDeposit >= 0 && fixedDeposit <= 100000)) {
      toast.error('The fixed deposit must be RM0 to RM100,000, or blank for 30%.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        features: featuresInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        year: Number(form.year),
        seats: Number(form.seats),
        price_per_day: Number(form.price_per_day),
        deposit_amount: Number(form.deposit_amount || 0),
        contact_admin_id: form.contact_admin_id || null,
        long_rental_enabled: form.long_rental_enabled !== false,
        weekly_discount_pct: weekly,
        monthly_discount_pct: monthly,
        rate_packages: packages,
        max_rental_days: maxDays,
        fixed_deposit: fixedDeposit,
      };
      delete data.id;
      delete data.created_at;
      delete data.updated_at;

      if (editing) {
        await updateCar(editing, data);
      } else {
        data.fleet_group_id = activeFleetId;
        await createCar(data);
      }
      setShowForm(false);
      toast.success(editing ? 'Car updated' : 'Car added');
      refetch();
      // Price estimates on the Counter and booking pages use the new discounts
      queryClient.invalidateQueries({ queryKey: ['long-rental-rates'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(carId) {
    try {
      setDeleting(true);
      await deleteCar(carId);
      toast.success('Car deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminLayout title="Manage Cars">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-400">
          {cars.length} car{cars.length !== 1 ? 's' : ''} in fleet
        </p>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add Car
        </button>
      </div>

      {/* Car Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Edit Car' : 'Add New Car'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="input-label">Car Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-field"
                    placeholder="Perodua Myvi"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Brand *</label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="input-field"
                    placeholder="Perodua"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Model *</label>
                  <input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="input-field"
                    placeholder="Myvi 1.5 AV"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="input-field"
                    min="2000"
                    max="2030"
                  />
                </div>
                <div>
                  <label className="input-label">Seats</label>
                  <input
                    type="number"
                    value={form.seats}
                    onChange={(e) => setForm({ ...form, seats: e.target.value })}
                    className="input-field"
                    min="2"
                    max="15"
                  />
                </div>
                <div>
                  <label className="input-label">Transmission</label>
                  <select
                    value={form.transmission}
                    onChange={(e) => setForm({ ...form, transmission: e.target.value })}
                    className="input-field"
                  >
                    <option value="Auto">Auto</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Fuel Type</label>
                  <select
                    value={form.fuel_type}
                    onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Price/Day (MYR) *</label>
                  <input
                    type="number"
                    value={form.price_per_day}
                    onChange={(e) => setForm({ ...form, price_per_day: e.target.value })}
                    className="input-field"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Deposit (MYR)</label>
                  <input
                    type="number"
                    value={form.deposit_amount || ''}
                    onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                    className="input-field"
                    min="0"
                    placeholder="0"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Not used for bookings: the deposit is always 30% of the rental, at least RM100.
                  </p>
                </div>
                <div>
                  <label className="input-label">Available</label>
                  <select
                    value={form.is_available ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, is_available: e.target.value === 'true' })}
                    className="input-field"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Commercial vehicle (GDL required)
                </label>
                <select
                  value={form.requires_gdl ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, requires_gdl: e.target.value === 'true' })}
                  className="input-field"
                >
                  <option value="false">No: any verified customer can book</option>
                  <option value="true">Yes: customers need a valid GDL</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  For panel vans and other goods vehicles. Online bookings need a GDL valid until
                  the return date. Bookings you make for a customer and Counter rentals aren&apos;t
                  blocked: check the customer&apos;s GDL in person.
                </p>
              </div>

              <LongTermBookings
                form={form}
                setForm={setForm}
                fleet={fleetOf(form.fleet_group_id || activeFleetId) || activeFleet}
              />

              <div>
                <label className="input-label">Image URL</label>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="input-label">Plate Number</label>
                <input
                  value={form.plate_number || ''}
                  onChange={(e) => setForm({ ...form, plate_number: e.target.value.toUpperCase() })}
                  className="input-field font-mono"
                  placeholder="ABC1234"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="input-label flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> WhatsApp contact
                </label>
                <select
                  value={form.contact_admin_id || ''}
                  onChange={(e) => setForm({ ...form, contact_admin_id: e.target.value || null })}
                  className="input-field"
                >
                  <option value="">
                    Fleet number
                    {activeFleet?.support_whatsapp
                      ? ` (+${activeFleet.support_whatsapp.replace(/\D/g, '')})`
                      : ''}
                  </option>
                  {contacts.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.display_name} · {c.whatsapp ? `+${c.whatsapp}` : 'no WhatsApp number yet'}
                    </option>
                  ))}
                  {form.contact_admin_id &&
                    !contacts.some((c) => c.user_id === form.contact_admin_id) && (
                      <option value={form.contact_admin_id}>
                        Someone no longer in this fleet (the fleet number is used)
                      </option>
                    )}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Customers who pick this car WhatsApp this person. Each admin saves their own
                  number in Fleet Settings; until they do, the fleet number is used.
                </p>
              </div>

              <div>
                <label className="input-label">Features (comma separated)</label>
                <input
                  value={featuresInput}
                  onChange={(e) => setFeaturesInput(e.target.value)}
                  className="input-field"
                  placeholder="Bluetooth, Keyless Entry, Rear Camera"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : editing ? 'Update Car' : 'Add Car'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Car List */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="glass-card text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : cars.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No cars yet"
          description="Add your first car to start receiving bookings."
          action={
            <button onClick={openNew} className="btn-primary text-sm">
              Add First Car
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {cars.map((car) => (
            <div
              key={car.id}
              className="glass-card flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <div className="w-full sm:w-24 h-16 rounded-xl overflow-hidden shrink-0 bg-dark-800">
                {car.image_url ? (
                  <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-slate-700" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold truncate">{car.name}</h3>
                  {car.plate_number && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 shrink-0">
                      {car.plate_number}
                    </span>
                  )}
                  {!car.is_available && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                      Unavailable
                    </span>
                  )}
                  {car.requires_gdl && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0"
                      title="Commercial vehicle: customers need a valid GDL"
                    >
                      GDL
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {car.brand} {car.model} · {car.year} · {car.transmission} · {car.seats} seats
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <MessageCircle className="w-3 h-3 text-green-500/70" />
                  {contactLabel(car.contact_admin_id, contacts)}
                </p>
                {docAlerts.some((a) => a.car.id === car.id) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {docAlerts
                      .filter((a) => a.car.id === car.id)
                      .map(({ doc, status }) => (
                        <Link
                          key={doc.id}
                          to="/admin/car-documents"
                          className={`px-2 py-0.5 rounded-full text-[10px] border ${
                            status === 'expired'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}
                        >
                          {DOC_LABELS[doc.doc_type]} {status === 'expired' ? 'expired' : 'expires'}{' '}
                          {formatDate(doc.valid_until)}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold gradient-text">
                  {formatMYR(car.price_per_day)}/day
                </p>
                <p className="text-[11px] text-slate-500">
                  {longTermLabel(carLongRentalRates(car, fleetOf(car.fleet_group_id)))}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/admin/cars/${car.id}/history`}
                  title="History"
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <History className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => openEdit(car)}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {deleteConfirmId === car.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(car.id)}
                      disabled={deleting}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(car.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

/** A discount box: blank is the fleet's discount (null). */
function discountValue(value) {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

/** A car's long-rental discounts, as the car list shows them. */
function longTermLabel(rates) {
  const { weekly_discount_pct: weekly, monthly_discount_pct: monthly } = rates;
  const packages = packageLines(rates);
  if (packages.length)
    return `Packages: ${packages.join(' · ')}${rates.max_days ? ` · max ${rates.max_days} days` : ''}`;
  if (!weekly && !monthly) return 'No long-term discount';
  return `${weekly}% off 7+ days · ${monthly}% off 30+ days`;
}

const LONG_TERM_TIERS = [
  { field: 'weekly_discount_pct', label: '7 days or more', days: 7, per: 'week' },
  { field: 'monthly_discount_pct', label: '30 days or more', days: 30, per: 'month' },
];

/**
 * A car's long-rental pricing: either long-term discounts, as a Trevo host
 * sets them (on or off, % off for 7+ and 30+ days, blank = the fleet's), or
 * packages (a price for 2 days, 3 days, a week…; the 1-day price is the
 * Price/Day box). Also the longest rental and a fixed deposit, and what the
 * customer pays for some lengths.
 */
function LongTermBookings({ form, setForm, fleet }) {
  const usesPackages = Array.isArray(form.rate_packages);
  const rate = Number(form.price_per_day) || 0;
  const rates = carLongRentalRates({ ...form, long_rental_enabled: true }, fleet);

  function choosePackages() {
    if (usesPackages) return;
    // Start from what the discounts give today, to edit
    const at = (days, pct) => Math.round(rate * days * (1 - pct / 100));
    setForm({
      ...form,
      rate_packages: [
        { days: 7, total: at(7, rates.weekly_discount_pct) },
        { days: 30, total: at(30, rates.monthly_discount_pct) },
      ],
    });
  }

  // What the customer pays, as the website will price it
  const preview = [1, 2, 3, 7, 14, 30]
    .filter((days) => !form.max_rental_days || days <= Number(form.max_rental_days))
    .map((days) => {
      const end = new Date(Date.UTC(2026, 0, 1 + days)).toISOString().slice(0, 10);
      const price = calculatePrice(rate, '2026-01-01', end, {
        ...carLongRentalRates(form, fleet),
        packages: usesPackages ? [{ days: 1, total: rate }, ...cleanPackages(form)] : null,
      });
      return `${days} day${days === 1 ? '' : 's'} ${formatMYR(price.total)}`;
    });

  return (
    <div className="rounded-xl border border-white/10 p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-white">Long rentals</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Price longer rentals with a discount off the daily rate, or with your own package prices
          (e.g. 3 days RM500, 1 week RM1,000).
        </p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, rate_packages: null })}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              usesPackages
                ? 'border-white/10 text-slate-400 hover:text-white'
                : 'border-violet-500/40 bg-violet-500/15 text-violet-200'
            }`}
          >
            Discounts
          </button>
          <button
            type="button"
            onClick={choosePackages}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              usesPackages
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                : 'border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Packages
          </button>
        </div>
      </div>

      {usesPackages ? (
        <PackageEditor form={form} setForm={setForm} rate={rate} />
      ) : (
        <DiscountTiers form={form} setForm={setForm} fleet={fleet} rates={rates} rate={rate} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-300">Longest rental (days)</label>
          <input
            type="number"
            value={form.max_rental_days ?? ''}
            onChange={(e) => setForm({ ...form, max_rental_days: e.target.value })}
            className="input-field py-1.5 mt-1"
            min="1"
            max="365"
            step="1"
            placeholder="No limit"
          />
        </div>
        <div>
          <label className="text-xs text-slate-300">Fixed deposit (RM)</label>
          <input
            type="number"
            value={form.fixed_deposit ?? ''}
            onChange={(e) => setForm({ ...form, fixed_deposit: e.target.value })}
            className="input-field py-1.5 mt-1"
            min="0"
            step="1"
            placeholder="30%, min RM100"
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-400">Customer pays: {preview.join(' · ')}</p>
      <p className="text-[11px] text-slate-500">Bookings already made keep their price.</p>
    </div>
  );
}

/** The packages being edited, as numbers: days over 1 with a price, shortest first. */
function cleanPackages(form) {
  return (Array.isArray(form.rate_packages) ? form.rate_packages : [])
    .map((p) => ({ days: Number(p.days), total: Number(p.total) }))
    .filter((p) => Number.isInteger(p.days) && p.days > 1 && p.total > 0)
    .sort((a, b) => a.days - b.days);
}

/** Package rows: how many days and the price for them. */
function PackageEditor({ form, setForm, rate }) {
  const rows = (form.rate_packages || []).filter((p) => Number(p.days) !== 1);
  const update = (next) => setForm({ ...form, rate_packages: next });
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">
        1 day: {formatMYR(rate)} (the Price/Day box). Other lengths are priced pro rata from the
        package before, never more than the next one.
      </p>
      {rows.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="number"
            value={p.days}
            onChange={(e) =>
              update(rows.map((r, j) => (j === i ? { ...r, days: e.target.value } : r)))
            }
            className="input-field w-20 py-1.5"
            min="2"
            max="365"
            step="1"
            aria-label="Days"
          />
          <span className="text-xs text-slate-400">days for RM</span>
          <input
            type="number"
            value={p.total}
            onChange={(e) =>
              update(rows.map((r, j) => (j === i ? { ...r, total: e.target.value } : r)))
            }
            className="input-field w-28 py-1.5"
            min="1"
            step="1"
            aria-label="Price"
          />
          <button
            type="button"
            onClick={() => update(rows.filter((_, j) => j !== i))}
            className="text-xs text-red-400 hover:text-red-300 px-2"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update([...rows, { days: '', total: '' }])}
        className="text-xs text-violet-400 hover:text-violet-300"
      >
        + Add package
      </button>
    </div>
  );
}

/** The long-term discounts: on or off, % off for 7+ and 30+ days. */
function DiscountTiers({ form, setForm, fleet, rates, rate }) {
  const on = form.long_rental_enabled !== false;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] text-slate-500">
          Discounts for customers booking 7 days or more. More chance of longer bookings.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Long-term bookings"
          onClick={() => setForm({ ...form, long_rental_enabled: !on })}
          className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${
            on ? 'bg-violet-500' : 'bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              on ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {LONG_TERM_TIERS.map(({ field, label, days, per }) => {
        const base = rate * days;
        const total = base - Math.round(base * rates[field]) / 100;
        return (
          <div
            key={field}
            className={`flex items-end justify-between gap-3 transition-opacity ${
              on ? '' : 'opacity-40'
            }`}
          >
            <div>
              <label className="text-xs text-slate-300">If customers book {label}</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={form[field] ?? ''}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="input-field w-20 py-1.5"
                  min="0"
                  max="90"
                  step="0.5"
                  placeholder={String(Number(fleet?.[field] || 0))}
                  disabled={!on}
                />
                <span className="text-xs text-slate-400">% off</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500">Customer pays</p>
              <p className="text-sm font-semibold text-violet-300">
                {formatMYR(total)}/{per}
              </p>
              <p className="text-[11px] text-slate-500">{formatMYR(total / days)}/day</p>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-slate-500">
        {on
          ? `A blank box uses the fleet's discount (${Number(fleet?.weekly_discount_pct || 0)}% and ${Number(fleet?.monthly_discount_pct || 0)}%, Fleet Settings).`
          : 'Off: no discount, however long the rental.'}
      </p>
    </div>
  );
}

/** Who customers WhatsApp about a car, as the car list shows it. */
function contactLabel(contactId, contacts) {
  const contact = contacts.find((c) => c.user_id === contactId);
  if (!contact) return 'Fleet WhatsApp number';
  return contact.whatsapp
    ? `${contact.display_name} (+${contact.whatsapp})`
    : `${contact.display_name} · no number yet, fleet number used`;
}
