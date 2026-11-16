// Versions of the rental agreement's terms (src/components/AgreementTerms.jsx).
// A signed agreement keeps the version its renter signed: version 1 before
// TERMS_V2_FROM, version 2 after.

export const TERMS_V2_FROM = '2026-11-16T22:45:00+08:00';
export const TERMS_V2_DATE = '16 Nov 2026';

/** The terms version an agreement signed at `agreedAt` holds (no date: the current one). */
export function termsVersion(agreedAt) {
  return agreedAt && Date.parse(agreedAt) < Date.parse(TERMS_V2_FROM) ? 1 : 2;
}
