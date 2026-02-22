import { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAdminCars, createCar, updateCar, deleteCar } from '../../hooks/useAdmin';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatMYR } from '../../utils/pricing';
import {
  Plus, Pencil, Trash2, X, Save, Car, Loader2, Image as ImageIcon
} from 'lucide-react';

const EMPTY_CAR = {
  name: '', brand: '', model: '', year: new Date().getFullYear(),
  transmission: 'Auto', seats: 5, fuel_type: 'Petrol',
  price_per_day: 150, deposit_amount: 0, image_url: '',
  plate_number: '', features: [], is_available: true,
};

export default function AdminCars() {
  const toast = useToast();
  const { cars, loading, error, refetch } = useAdminCars();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CAR);
  const [saving, setSaving] = useState(false);
  const [featuresInput, setFeaturesInput] = useState('');

  function openNew() {
    setEditing(null);
    setForm(EMPTY_CAR);
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
    setSaving(true);
    try {
      const data = {
        ...form,
        features: featuresInput.split(',').map(s => s.trim()).filter(Boolean),
        year: Number(form.year),
        seats: Number(form.seats),
        price_per_day: Number(form.price_per_day),
      };
      delete data.id;
      delete data.created_at;
      delete data.updated_at;

      if (editing) {
        await updateCar(editing, data);
      } else {
        await createCar(data);
      }
      setShowForm(false);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(carId) {
    if (!confirm('Delete this car? This cannot be undone.')) return;
    try {
      await deleteCar(carId);
      toast.success('Car deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Manage Cars">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-400">{cars.length} car{cars.length !== 1 ? 's' : ''} in fleet</p>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add Car
        </button>
      </div>

      {/* Car Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Car' : 'Add New Car'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="input-label">Car Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Perodua Myvi" required />
                </div>
                <div>
                  <label className="input-label">Brand *</label>
                  <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="input-field" placeholder="Perodua" required />
                </div>
                <div>
                  <label className="input-label">Model *</label>
                  <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="input-field" placeholder="Myvi 1.5 AV" required />
                </div>
                <div>
                  <label className="input-label">Year</label>
                  <input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="input-field" min="2000" max="2030" />
                </div>
                <div>
                  <label className="input-label">Seats</label>
                  <input type="number" value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })} className="input-field" min="2" max="15" />
                </div>
                <div>
                  <label className="input-label">Transmission</label>
                  <select value={form.transmission} onChange={e => setForm({ ...form, transmission: e.target.value })} className="input-field">
                    <option value="Auto">Auto</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Fuel Type</label>
                  <select value={form.fuel_type} onChange={e => setForm({ ...form, fuel_type: e.target.value })} className="input-field">
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Price/Day (MYR) *</label>
                  <input type="number" value={form.price_per_day} onChange={e => setForm({ ...form, price_per_day: e.target.value })} className="input-field" min="1" required />
                </div>
                <div>
                  <label className="input-label">Available</label>
                  <select value={form.is_available ? 'true' : 'false'} onChange={e => setForm({ ...form, is_available: e.target.value === 'true' })} className="input-field">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Image URL</label>
                <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="input-field" placeholder="https://..." />
              </div>

              <div>
                <label className="input-label">Plate Number</label>
                <input value={form.plate_number || ''} onChange={e => setForm({ ...form, plate_number: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="ABC1234" maxLength={10} />
              </div>

              <div>
                <label className="input-label">Features (comma separated)</label>
                <input value={featuresInput} onChange={e => setFeaturesInput(e.target.value)} className="input-field" placeholder="Bluetooth, Keyless Entry, Rear Camera" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
        <div className="glass-card text-center"><p className="text-red-400">{error}</p></div>
      ) : cars.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No cars yet"
          description="Add your first car to start receiving bookings."
          action={<button onClick={openNew} className="btn-primary text-sm">Add First Car</button>}
        />
      ) : (
        <div className="space-y-3">
          {cars.map(car => (
            <div key={car.id} className="glass-card flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">Unavailable</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{car.brand} {car.model} · {car.year} · {car.transmission} · {car.seats} seats</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold gradient-text">{formatMYR(car.price_per_day)}/day</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(car)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(car.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
