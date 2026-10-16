import { format, parseISO, differenceInDays, addDays, isBefore, isToday } from 'date-fns';

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

/**
 * First and last day (YYYY-MM-DD, local time) of a report period: 'today',
 * 'month' (the whole calendar month), 'custom' (either end may be blank) or
 * anything else for all time. A blank end means open-ended.
 */
export function periodRange(preset, start = '', end = '') {
  const today = getTodayString();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'month') {
    const [y, m] = today.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${today.slice(0, 8)}01`, to: `${today.slice(0, 8)}${lastDay}` };
  }
  if (preset === 'custom') return { from: start || '', to: end || '' };
  return { from: '', to: '' };
}

/** Whether a date (YYYY-MM-DD, or a timestamp) falls in a periodRange(). */
export function inPeriod(date, { from, to }) {
  const day = String(date || '').slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
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
