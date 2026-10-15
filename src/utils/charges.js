// Charges staff can add when a car comes back (see bubatrent_admin_return_booking).
export const CHARGE_KINDS = [
  { value: 'late_return', label: 'Late return' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'damage', label: 'Damage', needsDescription: true },
  { value: 'other', label: 'Other', needsDescription: true },
];

export function chargeLabel(kind) {
  return CHARGE_KINDS.find((k) => k.value === kind)?.label || kind;
}

/** Rows from ChargesEditor → what the database functions take. Throws a readable error. */
export function chargesForSubmit(rows) {
  return rows.map((row, i) => {
    const kind = CHARGE_KINDS.find((k) => k.value === row.kind);
    const amount = Number(row.amount);
    const description = (row.description || '').trim();
    if (!kind) throw new Error(`Charge ${i + 1}: choose a type.`);
    if (!(amount > 0)) throw new Error(`Charge ${i + 1}: enter an amount above RM0.`);
    if (kind.needsDescription && !description)
      throw new Error(`Charge ${i + 1}: describe the ${kind.label.toLowerCase()}.`);
    return { kind: row.kind, amount: Math.round(amount * 100) / 100, description };
  });
}

export function chargesTotal(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) > 0 ? Number(row.amount) : 0), 0);
}
