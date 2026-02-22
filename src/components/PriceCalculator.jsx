import { calculatePrice, formatMYR } from '../utils/pricing';
import { Clock, CreditCard, Receipt } from 'lucide-react';

export default function PriceCalculator({ pricePerDay, pickupDate, returnDate }) {
  const { days, total, deposit } = calculatePrice(pricePerDay, pickupDate, returnDate);

  if (!days || days <= 0) {
    return (
      <div className="glass-card text-center">
        <p className="text-slate-400 text-sm">Select dates to see pricing</p>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-4">
      <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Price Breakdown</h4>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            {formatMYR(pricePerDay)} × {days} day{days > 1 ? 's' : ''}
          </span>
          <span className="text-white font-medium">{formatMYR(total)}</span>
        </div>

        <div className="border-t border-white/5" />

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-400">
            <Receipt className="w-4 h-4" />
            Total Rental
          </span>
          <span className="text-white font-semibold text-lg">{formatMYR(total)}</span>
        </div>

        <div className="flex items-center justify-between text-sm bg-violet-500/10 rounded-xl px-4 py-3 -mx-1">
          <span className="flex items-center gap-2 text-violet-300">
            <CreditCard className="w-4 h-4" />
            Deposit (30%)
          </span>
          <span className="text-violet-300 font-bold text-lg">{formatMYR(deposit)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Pay {formatMYR(deposit)} deposit now to lock your booking. Remaining {formatMYR(total - deposit)} to be paid on pick-up.
      </p>
    </div>
  );
}
