import { LATEST_CHANGE } from '../data/changelog';

// The newest What's New date this browser has opened, for the dot in the admin
// menu. Per device only: a private window or cleared site data shows the dot
// again, which is harmless.
const KEY = 'rent2go.whatsNew.seen';

export function hasUnseenChanges() {
  try {
    return (localStorage.getItem(KEY) || '') < LATEST_CHANGE;
  } catch {
    return false;
  }
}

export function markChangesSeen(date) {
  try {
    localStorage.setItem(KEY, date);
  } catch {
    // storage blocked: the dot just stays
  }
}
