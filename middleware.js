// The home page link with dates (/?pickup=…&return=…): Vercel serves "/" from
// index.html before vercel.json's rewrites run, so link-preview bots never
// reach api/preview there. This runs for "/" only and sends just those bots
// on; everyone else continues to the app as before.

export const config = { matcher: '/' };

const BOTS =
  /WhatsApp|facebookexternalhit|Facebot|TelegramBot|Twitterbot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Viber|redditbot|Pinterestbot/;

export default function middleware(request) {
  if (!BOTS.test(request.headers.get('user-agent') || '')) {
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  const url = new URL(request.url);
  const dest = new URL('/api/preview', url);
  dest.searchParams.set('path', '/');
  for (const k of ['pickup', 'return']) {
    const v = url.searchParams.get(k);
    if (v) dest.searchParams.set(k, v);
  }
  return new Response(null, { headers: { 'x-middleware-rewrite': dest.toString() } });
}
