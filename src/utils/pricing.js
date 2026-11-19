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
    packages: car.rate_packages || null,
    max_days: car.max_rental_days ?? null,
    fixed_deposit: car.fixed_deposit ?? null,
  };
}

/** A car's package prices, shortest first: [{ days, total }], or [] when it has none. */
export function ratePackages(rates) {
  const list = Array.isArray(rates?.packages) ? rates.packages : [];
  return list
    .map((p) => ({ days: Number(p.days), total: Number(p.total) }))
    .filter((p) => p.days > 0)
    .sort((a, b) => a.days - b.days);
}

/**
 * The price for some days from a car's packages, as bubatrent_rental_quote
 * works it out: the largest package that fits, pro rata to whole ringgit,
 * never more than the next package.
 */
export function packageTotal(days, packages) {
  if (!packages.length || days <= 0) return null;
  const tier = [...packages].reverse().find((p) => p.days <= days) || packages[0];
  let total = tier.days === days ? tier.total : Math.round((tier.total * days) / tier.days);
  const next = packages.find((p) => p.days > days);
  if (next && next.total < total) total = next.total;
  return total;
}

/**
 * Price for the dates: the car's packages if it has them, else days x the
 * daily rate less the long-rental discount. Same as bubatrent_rental_quote,
 * which prices the booking. The deposit is the car's fixed deposit, else 30%
 * (minimum RM100). tooLong: more days than the car can be rented for.
 */
export function calculatePrice(pricePerDay, pickupDate, returnDate, rates = null) {
  if (!pickupDate || !returnDate) return NO_PRICE;

  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const diffTime = returnD.getTime() - pickup.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days <= 0) return NO_PRICE;

  const base = days * pricePerDay;
  const packages = ratePackages(rates);
  const isPackage = packages.length > 0;
  let total;
  let discountPct;
  let longDiscount;
  if (isPackage) {
    total = packageTotal(days, packages);
    longDiscount = base - total;
    discountPct = base > 0 ? Math.round(((base - total) * 10000) / base) / 100 : 0;
  } else {
    discountPct = longRentalPct(days, rates);
    longDiscount = Math.round(base * discountPct) / 100;
    total = base - longDiscount;
  }
  const fixedDeposit = rates?.fixed_deposit;
  const hasFixedDeposit =
    fixedDeposit !== null && fixedDeposit !== undefined && fixedDeposit !== '';
  const deposit = hasFixedDeposit ? Number(fixedDeposit) : Math.max(100, Math.ceil(total * 0.3));
  const maxDays = rates?.max_days ? Number(rates.max_days) : null;

  return {
    days,
    base,
    discountPct,
    longDiscount,
    total,
    deposit,
    isPackage,
    hasFixedDeposit,
    maxDays,
    tooLong: !!maxDays && days > maxDays,
  };
}

/** "Weekly rate (10% off)", or "Package price" for a car with packages; lang 'ms' for BM. */
export function longRentalLabel(days, pct, isPackage = false, lang = 'en') {
  const bm = lang === 'ms';
  if (isPackage) return bm ? 'Harga pakej' : 'Package price';
  if (bm) return `Kadar ${days >= 30 ? 'bulanan' : 'mingguan'} (diskaun ${Number(pct)}%)`;
  return `${days >= 30 ? 'Monthly' : 'Weekly'} rate (${Number(pct)}% off)`;
}

/** "3 days RM 500" etc. for a car's packages after the first day; lang 'ms' for BM. */
export function packageLines(rates, lang = 'en') {
  const bm = lang === 'ms';
  const packages = ratePackages(rates);
  const lines = packages
    .filter((p) => p.days > 1)
    .map((p) => {
      const label =
        p.days === 7
          ? bm
            ? '1 minggu'
            : '1 week'
          : p.days === 14
            ? bm
              ? '2 minggu'
              : '2 weeks'
            : p.days === 30
              ? bm
                ? '1 bulan'
                : '1 month'
              : `${p.days} ${bm ? 'hari' : 'days'}`;
      return `${label} ${formatMYR(p.total)}`;
    });
  // Longer than the last package: its daily rate
  const last = packages[packages.length - 1];
  if (lines.length && last && Number.isInteger(last.total / last.days)) {
    const perDay = formatMYR(last.total / last.days);
    lines.push(bm ? `kemudian ${perDay}/hari` : `then ${perDay}/day`);
  }
  return lines;
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
