/**
 * Phone number standardization utilities — Malaysia default
 *
 * Rules:
 *  - Strip spaces, dashes, parentheses
 *  - 0194961568  → +60194961568
 *  - 60194961568 → +60194961568
 *  - +601...     → keep as-is
 */

export function normalizePhone(raw) {
    if (!raw) return '';
    // Strip non-digit except leading +
    let cleaned = raw.replace(/[\s\-()]/g, '');
    // Remove any + not at start
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\+/g, '');
    // All digits now
    if (cleaned.startsWith('0')) {
        // Local format: 0194961568 → 60194961568
        cleaned = '60' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('60') && cleaned.length >= 9 && cleaned.length <= 11) {
        // Assume Malaysian if 9-11 digits without country code
        cleaned = '60' + cleaned;
    }
    return '+' + cleaned;
}

export function isValidMYPhone(normalized) {
    if (!normalized) return false;
    // Malaysian mobile: +60 1X-XXX XXXX (10-11 digits after +60)
    // Landline: +60 X-XXX XXXX
    const digits = normalized.replace(/\D/g, '');
    // Should start with 60, total 11-12 digits (60 + 9-10 local digits)
    return /^60[1-9]\d{7,9}$/.test(digits);
}
