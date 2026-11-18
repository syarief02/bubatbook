// The businesses whose vehicles are rented on Rent2Go, as printed on their
// invoices and the terms page.
//   Bubat Resources: SSM certificate, 5 May 2026 (registered until 20 Jan 2029).
//   Bocah Trading: its rental contract form (Kontrak Sewa Kenderaan / Komersial).
export const BUBAT_NAME = 'Bubat Resources';
export const BUBAT_SSM = '201603369817 (PG0408963-K)';
export const BOCAH_NAME = 'Bocah Trading';
export const BOCAH_SSM = '202003204563 (003146703-M)';
// Rent2Go's main WhatsApp (Bubat Resources), for messages not about one car
export const RENT2GO_WHATSAPP = '60194961568';

const COMPANIES = [
  {
    match: /bubat/i,
    ssm: BUBAT_SSM,
    address: [
      'A5-3 Villaria Kondominium',
      'Jalan PJS 5/32, Taman Desaria',
      '46000 Petaling Jaya, Selangor',
    ],
  },
  {
    match: /bocah/i,
    ssm: BOCAH_SSM,
    address: ['No. 72B, Jalan Selayang Baru', '68100 Batu Caves, Selangor'],
  },
];

/**
 * The registration number and address to print for a fleet ({ ssm, address })
 * or null for a fleet not listed here. No fleet: Bubat Resources.
 */
export function companyDetails(fleet) {
  const name = fleet ? fleet.name || '' : BUBAT_NAME;
  return COMPANIES.find((c) => c.match.test(name)) || null;
}
