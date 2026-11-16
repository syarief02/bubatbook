// Versions of the rental agreement's terms (src/components/AgreementTerms.jsx).
// A signed agreement keeps the version its renter signed: version 1 before
// TERMS_V2_FROM, version 2 until TERMS_V3_FROM, version 3 after.

export const TERMS_V2_FROM = '2026-11-16T22:45:00+08:00';
export const TERMS_V2_DATE = '16 Nov 2026';
export const TERMS_V3_FROM = '2026-11-17T00:45:00+08:00';
export const TERMS_V3_DATE = '17 Nov 2026';

/** The terms version an agreement signed at `agreedAt` holds (no date: the current one). */
export function termsVersion(agreedAt) {
  if (!agreedAt) return 3;
  const t = Date.parse(agreedAt);
  if (t < Date.parse(TERMS_V2_FROM)) return 1;
  if (t < Date.parse(TERMS_V3_FROM)) return 2;
  return 3;
}
