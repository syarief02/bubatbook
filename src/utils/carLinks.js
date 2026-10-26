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
