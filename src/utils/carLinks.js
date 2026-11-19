// A car's page address uses its plate without spaces, in lower case: /cars/vjc5290.
// Links made before used the car's id (/cars/<uuid>); those still open the page,
// which then shows the plate address instead.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isCarId = (value) => UUID.test(value || '');

/** "VJC 5290" -> "vjc5290"; the id when a car has no plate. */
export function carSlug(car) {
  return car?.plate_number ? car.plate_number.replace(/\s+/g, '').toLowerCase() : car?.id;
}

export function carPath(car) {
  return `/cars/${carSlug(car)}`;
}

const SITE_URL = 'https://www.rent2go.my';

/** The car page's full address, e.g. https://www.rent2go.my/cars/vjc5290 (for messages). */
export function carUrl(car) {
  return `${SITE_URL}${carPath(car)}`;
}

/**
 * The car as the admin needs it in a WhatsApp message: name, year and plate,
 * e.g. "Nissan NV200 Panel Van 2014 (WA 3301 U)". Several cars share a model,
 * so the plate tells them apart.
 */
export function carLabel(car) {
  if (!car) return 'the car';
  const name = car.name || [car.brand, car.model].filter(Boolean).join(' ');
  return `${name}${car.year ? ` ${car.year}` : ''}${car.plate_number ? ` (${car.plate_number})` : ''}`;
}
