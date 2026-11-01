const NO_PRICE = { days: 0, base: 0, discountPct: 0, longDiscount: 0, total: 0, deposit: 0 };

/**
 * The fleet's long-rental discount for a rental of this many days: weekly
 * from 7 days, monthly from 30 (rates from bubatrent_long_rental_rates).
 */
export function longRentalPct(days, rates) {
  if (!rates) return 0;
  if (days >= 30) return Number(rates.monthly_discount_pct || 0);
  if (days >= 7) return Number(rates.weekly_discount_pct || 0);
  return 0;
}

/**
 * A car's long-rental discounts, as bubatrent_car_long_rental_rates works
 * them out: none with long-term bookings off, else the car's own (a blank
 * one is its fleet's).
 */
export function carLongRentalRates(car, fleet) {
  const pct = (field) => {
    if (car.long_rental_enabled === false) return 0;
    const own = car[field];
    return Number(own === null || own === undefined || own === '' ? fleet?.[field] || 0 : own);
  };
  return {
    weekly_discount_pct: pct('weekly_discount_pct'),
    monthly_discount_pct: pct('monthly_discount_pct'),
  };
}

/**
 * Price for the dates: days x the daily rate, less the long-rental discount.
 * Same as bubatrent_rental_quote, which prices the booking.
 */
export function calculatePrice(pricePerDay, pickupDate, returnDate, rates = null) {
  if (!pickupDate || !returnDate) return NO_PRICE;

  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const diffTime = returnD.getTime() - pickup.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days <= 0) return NO_PRICE;

  const base = days * pricePerDay;
  const discountPct = longRentalPct(days, rates);
  const longDiscount = Math.round(base * discountPct) / 100;
  const total = base - longDiscount;
  const deposit = Math.max(100, Math.ceil(total * 0.3)); // 30% deposit, minimum RM100

  return { days, base, discountPct, longDiscount, total, deposit };
}

/** "Weekly rate (10% off)" for a rental of this many days. */
export function longRentalLabel(days, pct) {
  return `${days >= 30 ? 'Monthly' : 'Weekly'} rate (${Number(pct)}% off)`;
}

// Whole ringgit as "RM 140"; amounts with sen keep them, as "RM 85.50"
export function formatMYR(amount) {
  if (amount == null || isNaN(amount)) return 'RM 0';
  const sen = Math.round(Number(amount) * 100) % 100 !== 0;
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: sen ? 2 : 0,
    maximumFractionDigits: sen ? 2 : 0,
  }).format(amount);
}
