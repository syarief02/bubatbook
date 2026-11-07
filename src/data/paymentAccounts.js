// Where customers pay each fleet's deposits and rent: shown at checkout and in
// My Bookings, next to the receipt upload. Only the fleet's own business
// account, never a personal one. A fleet without an entry keeps "WhatsApp the
// admin for bank details", so another fleet's customers are never shown it.
//
// To add or change one: the bank, account number and holder exactly as the
// bank shows them, and the DuitNow QR from the bank's app cropped to the QR
// card in public/pay/.
export const PAYMENT_ACCOUNTS = {
  // BuBat Resources: its RHB business account (the owner's details, used since
  // 2017). QR: the RHB app's "BUBAT RESOURCES" DuitNow QR (Drive, Van Sewa > QR code).
  'a0000000-0000-0000-0000-000000000001': {
    holder: 'BUBAT RESOURCES',
    bank: 'RHB Bank',
    accountNumber: '25701400007329',
    qr: '/pay/bubat-resources-rhb-duitnow.png',
  },
};

export function paymentAccountFor(fleetId) {
  return (fleetId && PAYMENT_ACCOUNTS[fleetId]) || null;
}

// 25701400007329 -> 2570 1400 0073 29 (easier to read and type)
export function formatAccountNumber(number) {
  return String(number).replace(/(\d{4})(?=\d)/g, '$1 ');
}

// The reference customers put on the transfer: the booking code on receipts
export function bookingReference(bookingId) {
  return String(bookingId || '')
    .slice(0, 8)
    .toUpperCase();
}
