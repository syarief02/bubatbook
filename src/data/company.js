// Bubat Resources, the business that runs Rent2Go (SSM certificate, 5 May 2026;
// registered until 20 Jan 2029).
export const BUBAT_NAME = 'Bubat Resources';
export const BUBAT_SSM = '201603369817 (PG0408963-K)';

/** Whether a fleet (or no fleet) is Bubat Resources itself. */
export function isBubatFleet(fleet) {
  return !fleet || /bubat/i.test(fleet.name || '');
}
