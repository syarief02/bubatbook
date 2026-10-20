import { differenceInCalendarDays, parseISO } from 'date-fns';
import { getTodayString } from './dates';

// Road tax, insurance, Puspakom and GPS renewals recorded on each car
// (bubatrent_booking_car_documents). The newest expiry date of each type is
// the one that counts.

export const DOC_TYPES = [
  { id: 'road_tax', label: 'Road tax' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'puspakom', label: 'Puspakom' },
  { id: 'gps', label: 'GPS' },
];

export const DOC_LABELS = Object.fromEntries(DOC_TYPES.map((t) => [t.id, t.label]));

// The dashboard warns this many days before a document expires
export const DUE_SOON_DAYS = 30;

/** Days from today to the expiry date: 0 on the last valid day, negative once expired. */
export function daysLeft(validUntil, today = getTodayString()) {
  return differenceInCalendarDays(parseISO(validUntil), parseISO(today));
}

/** 'expired', 'due_soon' or 'valid'. A document is valid through its expiry date. */
export function documentStatus(validUntil, today = getTodayString()) {
  const left = daysLeft(validUntil, today);
  if (left < 0) return 'expired';
  if (left <= DUE_SOON_DAYS) return 'due_soon';
  return 'valid';
}

/** The current document of each type for one car: { road_tax: doc, ... } */
export function latestByType(docs) {
  const latest = {};
  for (const d of docs) {
    const cur = latest[d.doc_type];
    if (!cur || d.valid_until > cur.valid_until) latest[d.doc_type] = d;
  }
  return latest;
}

/**
 * Current documents that have expired or expire soon, most urgent first:
 * [{ car, doc, status, daysLeft }]. Only types with a record count, so a car
 * that never needs Puspakom is never flagged for it.
 */
export function documentAlerts(cars, docs, today = getTodayString()) {
  const byCar = {};
  for (const d of docs) {
    if (!byCar[d.car_id]) byCar[d.car_id] = [];
    byCar[d.car_id].push(d);
  }
  const alerts = [];
  for (const car of cars) {
    for (const doc of Object.values(latestByType(byCar[car.id] || []))) {
      const status = documentStatus(doc.valid_until, today);
      if (status !== 'valid') {
        alerts.push({ car, doc, status, daysLeft: daysLeft(doc.valid_until, today) });
      }
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** "expired 3 days ago", "expires today", "12 days left" */
export function daysLeftLabel(left) {
  if (left < -1) return `expired ${-left} days ago`;
  if (left === -1) return 'expired yesterday';
  if (left === 0) return 'expires today';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}
