import { Link } from 'react-router-dom';
import { Users, Fuel, Settings2, Calendar } from 'lucide-react';
import { formatMYR } from '../utils/pricing';

export default function CarCard({ car }) {
  return (
    <Link
      to={`/cars/${car.id}`}
      className="glass-card glass-card-hover block overflow-hidden group"
    >
      {/* Car Image */}
      <div className="relative -mx-6 -mt-6 mb-4 h-48 overflow-hidden">
        {car.image_url ? (
          <img
            src={car.image_url}
            alt={car.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center">
            <Calendar className="w-12 h-12 text-slate-700" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            {formatMYR(car.price_per_day)}/day
          </span>
        </div>
      </div>

      {/* Car Info */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-violet-300 transition-colors">
          {car.name}
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          {car.brand} {car.model} · {car.year}
        </p>

        {/* Specs */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Settings2 className="w-3.5 h-3.5" />
            {car.transmission}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {car.seats} seats
          </span>
          <span className="flex items-center gap-1">
            <Fuel className="w-3.5 h-3.5" />
            {car.fuel_type}
          </span>
        </div>
      </div>
    </Link>
  );
}
