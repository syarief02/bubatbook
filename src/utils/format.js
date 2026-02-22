export function maskSensitive(value) {
    if (!value || value.length < 4) return '****';
    return '****' + value.slice(-4);
}

export function formatPhone(phone) {
    if (!phone) return '';
    // Basic Malaysian phone format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('60')) {
        return '+' + cleaned.slice(0, 2) + ' ' + cleaned.slice(2, 4) + '-' + cleaned.slice(4);
    }
    if (cleaned.startsWith('0')) {
        return cleaned.slice(0, 3) + '-' + cleaned.slice(3);
    }
    return phone;
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
