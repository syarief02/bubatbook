import { format, parseISO, differenceInDays, addDays, isAfter, isBefore, isToday } from 'date-fns';

export function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
        return dateStr;
    }
}

export function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'dd/MM/yy');
    } catch {
        return dateStr;
    }
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm');
    } catch {
        return dateStr;
    }
}

export function getTodayString() {
    return format(new Date(), 'yyyy-MM-dd');
}

export function getTomorrowString() {
    return format(addDays(new Date(), 1), 'yyyy-MM-dd');
}

export function getDaysDifference(start, end) {
    if (!start || !end) return 0;
    return differenceInDays(parseISO(end), parseISO(start));
}

export function isDateInPast(dateStr) {
    if (!dateStr) return false;
    return isBefore(parseISO(dateStr), new Date()) && !isToday(parseISO(dateStr));
}

export function formatTimeRemaining(expiresAt) {
    if (!expiresAt) return '';
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
