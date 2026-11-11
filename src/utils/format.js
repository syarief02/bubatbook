export function maskSensitive(value) {
  if (!value || value.length < 4) return '****';
  return '****' + value.slice(-4);
}

/**
 * A Malaysian number the way people write it: 60194961568 → "+60 19-496 1568",
 * 601110045213 → "+60 11-1004 5213", 0194961568 → "019-496 1568".
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  const local = cleaned.startsWith('60')
    ? cleaned.slice(2)
    : cleaned.startsWith('0')
      ? cleaned.slice(1)
      : null;
  if (!local) return String(phone);
  // Mobiles have a two-digit prefix (19, 11), landlines one (3 for KL)
  const cut = local.startsWith('1') ? 2 : 1;
  const prefix = local.slice(0, cut);
  const rest = local.slice(cut);
  const grouped =
    rest.length === 7 || rest.length === 8 ? `${rest.slice(0, -4)} ${rest.slice(-4)}` : rest;
  return cleaned.startsWith('60') ? `+60 ${prefix}-${grouped}` : `0${prefix}-${grouped}`;
}

export function generateBookingRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'BR-';
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}

export function truncate(str, maxLen = 50) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}
