// Licence type noted when an admin creates a walk-in customer (profiles.gdl_license).
// Only a note: van bookings check the GDL's expiry date and photo (gdl_expiry,
// gdl_file_path), not this.
export const LICENCE_TYPES = [
  { value: 'NONE', label: 'Not noted' },
  { value: 'CDL', label: 'CDL (Competent Driving Licence)' },
  { value: 'GDL', label: 'GDL (Goods Driving Licence)' },
];

export function licenceTypeLabel(value) {
  return LICENCE_TYPES.find((o) => o.value === value)?.label || value;
}
