import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCars } from '../hooks/useCars';
import CarCard from '../components/CarCard';
import DateRangePicker from '../components/DateRangePicker';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Car, Shield, Zap, CreditCard, Search } from 'lucide-react';

export default function Home() {
  const { cars, loading, error } = useCars();
  const [searchParams] = useSearchParams();
  const [pickupDate, setPickupDate] = useState(searchParams.get('pickup') || '');
  const [returnDate, setReturnDate] = useState(searchParams.get('return') || '');

  const filteredCars = cars; // All cars - availability filtering done at booking time

  function handleSearch() {
    if (!pickupDate || !returnDate) {
      alert('Please select both pick-up and return dates.');
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="section-title">Our Fleet</h2>
            <p className="section-subtitle !mb-0">
              {cars.length} car{cars.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
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
