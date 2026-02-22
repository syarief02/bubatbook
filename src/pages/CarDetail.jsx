import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCar } from '../hooks/useCars';
import { useAuth } from '../hooks/useAuth';
import DateRangePicker from '../components/DateRangePicker';
import PriceCalculator from '../components/PriceCalculator';
import LoadingSpinner from '../components/LoadingSpinner';
import { calculatePrice, formatMYR } from '../utils/pricing';
import {
  ArrowLeft, Users, Fuel, Settings2, Calendar, MapPin,
  Shield, CheckCircle, Star
} from 'lucide-react';

export default function CarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { car, loading, error } = useCar(id);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  if (loading) return <LoadingSpinner fullScreen />;
  if (error || !car) {
    return (
      <div className="page-container text-center">
        <p className="text-red-400">Car not found</p>
        <Link to="/" className="text-violet-400 hover:underline mt-4 inline-block">Back to fleet</Link>
      </div>
    );
  }

  const { days, total, deposit } = calculatePrice(car.price_per_day, pickupDate, returnDate);

  function handleBookNow() {
    if (!user) {
      navigate(`/login`);
      return;
    }
    if (!pickupDate || !returnDate || days <= 0) return;
    navigate(`/checkout/${car.id}?pickup=${pickupDate}&return=${returnDate}`);
  }

  const features = car.features || [];

  return (
    <div className="page-container">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to fleet
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Car Details */}
        <div className="flex-1 min-w-0">
          {/* Image */}
          <div className="rounded-2xl overflow-hidden mb-6 aspect-[16/9]">
            {car.image_url ? (
              <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center">
                <Calendar className="w-16 h-16 text-slate-700" />
              </div>
            )}
          </div>

          {/* Car Info */}
          <div className="glass-card mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{car.name}</h1>
                <p className="text-slate-400">{car.brand} {car.model} · {car.year}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold gradient-text">{formatMYR(car.price_per_day)}</p>
                <p className="text-xs text-slate-500">per day</p>
              </div>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { icon: Settings2, label: 'Transmission', value: car.transmission },
                { icon: Users, label: 'Seats', value: `${car.seats} seats` },
                { icon: Fuel, label: 'Fuel', value: car.fuel_type },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="glass-card !p-3 text-center">
                  <Icon className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-medium text-white capitalize">{value}</p>
                </div>
              ))}
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {features.map((feature) => (
                    <span key={feature} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-300">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trust Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Shield, text: 'Fully Insured' },
              { icon: CheckCircle, text: 'Verified Vehicle' },
              { icon: Star, text: 'Premium Maintained' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 glass-card !p-3">
                <Icon className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-xs text-slate-400">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Booking Panel (Sticky) */}
        <div className="lg:w-96 shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="glass-card glow-sm animate-pulse-glow">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-violet-400" />
                Book This Car
              </h3>

              <DateRangePicker
                pickupDate={pickupDate}
                returnDate={returnDate}
                onPickupChange={setPickupDate}
                onReturnChange={setReturnDate}
                className="mb-4"
              />

              <button
                onClick={handleBookNow}
                disabled={!pickupDate || !returnDate || days <= 0}
                className="btn-primary w-full !py-4 text-base"
              >
                {!user ? 'Sign in to Book' : days > 0 ? `Book Now · Pay ${formatMYR(deposit)} Deposit` : 'Select Dates'}
              </button>

              {!user && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  You need to sign in before booking.
                </p>
              )}
            </div>

            {days > 0 && (
              <PriceCalculator
                pricePerDay={car.price_per_day}
                pickupDate={pickupDate}
                returnDate={returnDate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
