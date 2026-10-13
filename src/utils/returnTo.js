/**
 * Only same-site paths, so a returnTo link can't send people to another site.
 * Browsers treat "\" like "/", so "/\evil.com" would leave the site too.
 */
export function safeReturnTo(value) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/';
}
