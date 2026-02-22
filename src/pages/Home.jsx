import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCars } from '../hooks/useCars';
import CarCard from '../components/CarCard';
import DateRangePicker from '../components/DateRangePicker';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Car, Shield, Zap, CreditCard, Search } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Home() {
  const { cars, loading, error } = useCars();
  const [searchParams] = useSearchParams();
  const [pickupDate, setPickupDate] = useState(searchParams.get('pickup') || '');
  const [returnDate, setReturnDate] = useState(searchParams.get('return') || '');
  const [carSearch, setCarSearch] = useState('');
  const toast = useToast();

  const filteredCars = cars.filter(car => {
    if (!carSearch) return true;
    const q = carSearch.toLowerCase();
    return car.name.toLowerCase().includes(q)
      || car.brand.toLowerCase().includes(q)
      || car.model.toLowerCase().includes(q)
      || (car.plate_number || '').toLowerCase().includes(q);
  });

  function handleSearch() {
    if (!pickupDate || !returnDate) {
      toast.error('Please select both pick-up and return dates.');
      return;
    }
    const fleetSection = document.getElementById('fleet');
    if (fleetSection) {
      fleetSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial" />
        <div className="absolute inset-0 bg-grid" />
        <div className="relative page-container py-16 sm:py-24">
          <div className="max-w-3xl mx-auto text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-6">
              <Zap className="w-4 h-4" />
              Premium Car Rental in Malaysia
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              Drive Your Way,{' '}
              <span className="gradient-text">Hassle Free</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              Browse our curated fleet, pick your dates, and book instantly. Secure your ride with a simple deposit.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto glass-card animate-slide-up">
            <DateRangePicker
              pickupDate={pickupDate}
              returnDate={returnDate}
              onPickupChange={setPickupDate}
              onReturnChange={setReturnDate}
            />
            <div className="mt-4 flex justify-center">
              <button 
                onClick={handleSearch}
                className="btn-primary flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Find Available Cars
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="page-container -mt-4 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Shield, title: 'Verified Fleet', desc: 'All cars inspected and insured' },
            { icon: Zap, title: 'Instant Booking', desc: 'Book in minutes, drive today' },
            { icon: CreditCard, title: 'Secure Deposit', desc: '30% deposit locks your booking' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card flex items-center gap-4 !p-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Car Grid */}
      <section id="fleet" className="page-container scroll-mt-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="section-title">Our Fleet</h2>
            <p className="section-subtitle !mb-0">
              {filteredCars.length} car{filteredCars.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search cars..."
              value={carSearch}
              onChange={e => setCarSearch(e.target.value)}
              className="input-field !pl-10 !py-2 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card overflow-hidden animate-pulse">
                <div className="-mx-6 -mt-6 mb-4 h-48 bg-white/5" />
                <div className="h-5 bg-white/5 rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/2 mb-4" />
                <div className="flex gap-4">
                  <div className="h-3 bg-white/5 rounded w-16" />
                  <div className="h-3 bg-white/5 rounded w-16" />
                  <div className="h-3 bg-white/5 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="glass-card text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredCars.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No cars available"
            description="Check back soon — our fleet is being updated."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.map((car, i) => (
              <div key={car.id} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <CarCard car={car} pickupDate={pickupDate} returnDate={returnDate} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
