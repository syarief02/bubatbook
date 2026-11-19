import { calculatePrice, formatMYR, longRentalLabel } from '../utils/pricing';
import { Clock, CreditCard, Receipt, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PriceCalculator({ pricePerDay, pickupDate, returnDate, rates }) {
  const {
    days,
    base,
    discountPct,
    longDiscount,
    total,
    deposit,
    isPackage,
    hasFixedDeposit,
    maxDays,
    tooLong,
  } = calculatePrice(pricePerDay, pickupDate, returnDate, rates);
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  if (!days || days <= 0) {
    return (
      <div className="glass-card text-center">
        <p className="text-slate-400 text-sm">{t('Select dates to see pricing')}</p>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-4">
      <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        {t('Price Breakdown')}
      </h4>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            {formatMYR(pricePerDay)} × {t('{{count}} days', { count: days })}
          </span>
          <span className="text-white font-medium">{formatMYR(base)}</span>
        </div>

        {longDiscount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-green-400">
              <Tag className="w-4 h-4" />
              {longRentalLabel(days, discountPct, isPackage, lang)}
            </span>
            <span className="text-green-400 font-medium">-{formatMYR(longDiscount)}</span>
          </div>
        )}

        <div className="border-t border-white/5" />

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-400">
            <Receipt className="w-4 h-4" />
            {t('Total Rental')}
          </span>
          <span className="text-white font-semibold text-lg">{formatMYR(total)}</span>
        </div>

        <div className="flex items-center justify-between text-sm bg-violet-500/10 rounded-xl px-4 py-3 -mx-1">
          <span className="flex items-center gap-2 text-violet-300">
            <CreditCard className="w-4 h-4" />
            {hasFixedDeposit ? 'Deposit' : t('Deposit (30%, min RM100)')}
          </span>
          <span className="text-violet-300 font-bold text-lg">{formatMYR(deposit)}</span>
        </div>
      </div>

      {tooLong && (
        <p className="text-xs text-amber-300">
          {t('This car can be rented for up to {{maxDays}} days. Choose an earlier return date.', {
            maxDays,
          })}
        </p>
      )}

      <p className="text-xs text-slate-500">
        {t(
          'Pay {{deposit}} deposit now to lock your booking. The full rental of {{total}} is paid on pick-up.',
          { deposit: formatMYR(deposit), total: formatMYR(total) }
        )}
      </p>
    </div>
  );
}
