import { Plus, Trash2 } from 'lucide-react';
import { CHARGE_KINDS } from '../utils/charges';

/**
 * List of charges (type, amount, note) for returning a car or settling a
 * held deposit. Staff type every amount themselves.
 */
export default function ChargesEditor({ rows, onChange, disabled = false }) {
  function update(i, field, value) {
    onChange(rows.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const kind = CHARGE_KINDS.find((k) => k.value === row.kind);
        return (
          <div key={i} className="flex flex-col sm:flex-row gap-2">
            <select
              value={row.kind}
              onChange={(e) => update(i, 'kind', e.target.value)}
              disabled={disabled}
              className="input-field !py-1.5 text-sm sm:w-36"
            >
              {CHARGE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={row.amount}
              onChange={(e) => update(i, 'amount', e.target.value)}
              disabled={disabled}
              placeholder="RM"
              className="input-field !py-1.5 text-sm sm:w-28"
            />
            <input
              type="text"
              value={row.description}
              onChange={(e) => update(i, 'description', e.target.value)}
              disabled={disabled}
              placeholder={
                kind?.needsDescription
                  ? 'What happened (required)'
                  : 'Note, e.g. 6 hours late (optional)'
              }
              className="input-field !py-1.5 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              disabled={disabled}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 self-start"
              aria-label="Remove charge"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, { kind: 'late_return', amount: '', description: '' }])}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" /> Add charge
      </button>
    </div>
  );
}
