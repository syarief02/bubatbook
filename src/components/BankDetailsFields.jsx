import { useId } from 'react';
import { MALAYSIAN_BANKS } from '../utils/banks';

// Bank, account number and account holder. value and onChange use the
// profile's column names (see bankFromProfile). small: the compact admin style.
export default function BankDetailsFields({
  value,
  onChange,
  disabled = false,
  required = true,
  small = false,
}) {
  const listId = useId();
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const mark = required ? ' *' : '';
  const label = small ? 'text-[10px] text-slate-500 mb-1 block' : 'input-label';
  const input = small ? 'input-field !py-1.5 text-xs' : 'input-field';

  return (
    <div className={small ? 'space-y-2' : 'space-y-4'}>
      <div>
        <label className={label}>Bank{mark}</label>
        <input
          type="text"
          list={listId}
          value={value.bank_name}
          onChange={set('bank_name')}
          className={input}
          placeholder="e.g. Maybank"
          maxLength={100}
          autoComplete="off"
          disabled={disabled}
        />
        <datalist id={listId}>
          {MALAYSIAN_BANKS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>
      <div>
        <label className={label}>Account Number{mark}</label>
        <input
          type="text"
          inputMode="numeric"
          value={value.bank_account_number}
          onChange={set('bank_account_number')}
          className={input}
          placeholder="e.g. 1122 3344 5566"
          maxLength={30}
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div>
        <label className={label}>Account Holder Name{mark}</label>
        <input
          type="text"
          value={value.bank_account_holder}
          onChange={set('bank_account_holder')}
          className={input}
          placeholder="Name on the bank account"
          maxLength={150}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
