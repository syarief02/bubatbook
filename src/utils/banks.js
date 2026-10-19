// Banks in Malaysia, suggested in the bank details form (any other name can be typed)
export const MALAYSIAN_BANKS = [
  'Maybank',
  'CIMB Bank',
  'Public Bank',
  'RHB Bank',
  'Hong Leong Bank',
  'AmBank',
  'Bank Islam',
  'Bank Rakyat',
  'BSN',
  'Affin Bank',
  'Alliance Bank',
  'Bank Muamalat',
  'Agrobank',
  'OCBC Bank',
  'HSBC Bank',
  'UOB',
  'Standard Chartered',
  'MBSB Bank',
  'Al Rajhi Bank',
  'Kuwait Finance House',
  'GXBank',
  'AEON Bank',
  'Boost Bank',
  'Ryt Bank',
];

export const EMPTY_BANK = { bank_name: '', bank_account_number: '', bank_account_holder: '' };

// The three bank fields of a profile, for a form
export function bankFromProfile(p) {
  return {
    bank_name: p?.bank_name || '',
    bank_account_number: p?.bank_account_number || '',
    bank_account_holder: p?.bank_account_holder || '',
  };
}

// Customers often type spaces or dashes; the database stores digits only
export const cleanAccountNumber = (s) => (s || '').replace(/[\s-]/g, '');

export const hasBankDetails = (p) => Boolean(p?.bank_account_number);

// The same rules as the database: all three or none, 6 to 20 digits.
// optional: an all-empty form is fine (counter customers).
export function bankDetailsError(bank, { optional = false } = {}) {
  const name = bank.bank_name?.trim();
  const number = cleanAccountNumber(bank.bank_account_number);
  const holder = bank.bank_account_holder?.trim();
  if (optional && !name && !number && !holder) return null;
  if (!name) return 'Bank name is required.';
  if (!number) return 'Bank account number is required.';
  if (!/^\d{6,20}$/.test(number)) return 'Bank account number should be 6 to 20 digits.';
  if (!holder) return "Account holder's name is required.";
  return null;
}

// The values to save: trimmed, digits only, blanks as null
export function bankForSave(bank) {
  return {
    bank_name: bank.bank_name?.trim() || null,
    bank_account_number: cleanAccountNumber(bank.bank_account_number) || null,
    bank_account_holder: bank.bank_account_holder?.trim() || null,
  };
}
