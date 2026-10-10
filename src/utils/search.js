/**
 * Build a PostgREST `or()` filter matching `term` anywhere in any of `columns`.
 * Values are double-quoted so commas, dots and brackets in what the admin types
 * (e.g. an email address) don't break the filter syntax.
 */
export function ilikeAny(columns, term) {
  const value = term.trim().replace(/[\\"]/g, '\\$&');
  return columns.map((column) => `${column}.ilike."%${value}%"`).join(',');
}
