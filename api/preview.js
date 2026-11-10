// Link previews (WhatsApp, Facebook, Telegram...). Their bots don't run the
// app's JavaScript, so every link used to show the same title and picture.
// vercel.json sends only those bots here (by user agent); this returns the
// normal index.html with a title, description and picture for that link:
// the car and its photo, the dates picked, or which booking page it is.
// Visitors never come here: they get the app as before.

const SITE = 'https://www.rent2go.my';
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PAGES = {
  '/login': ['Sign in to Rent2Go', 'Sign in to see your bookings, sign the agreement and pay.'],
  '/signup': ['Create your Rent2Go account', 'Sign up to book a car or van in a few minutes.'],
  '/verify': [
    'Verify your Rent2Go account',
    'Upload your IC and driving licence to start booking.',
  ],
  '/complete-profile': [
    'Complete your Rent2Go profile',
    'Add your phone number and details to finish signing up.',
  ],
  '/profile': ['Your Rent2Go profile', 'Your details, documents and credit balance.'],
  '/my-bookings': ['Your Rent2Go bookings', 'Your bookings, payments and rental agreements.'],
  '/privacy': ['Rent2Go privacy policy', 'How Rent2Go collects, uses and protects your data.'],
  '/reset-password': ['Reset your Rent2Go password', 'Choose a new password for your account.'],
};

const ADMIN_PAGES = {
  '': 'Dashboard',
  cars: 'Cars',
  counter: 'Counter',
  bookings: 'Bookings',
  'bookings/create': 'Book for customer',
  customers: 'Customers',
  'customers/create': 'New customer',
  'customer-history': 'Customer history',
  'car-documents': 'Car documents',
  sales: 'Sales',
  expenses: 'Expenses',
  fleet: 'Fleet settings',
  'fleet/members': 'Fleet members',
  groups: 'Fleets',
  'change-requests': 'Change requests',
  manual: 'User manual',
  'whats-new': "What's New",
  'upload-logs': 'Upload logs',
};

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function parseDate(s) {
  if (!DATE.test(s || '')) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const day = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const longDay = (d) => `${WEEKDAYS[d.getUTCDay()]} ${day(d)} ${d.getUTCFullYear()}`;

/** "12–15 Nov 2026 (3 days)" and "Thu 12 Nov 2026 to Sun 15 Nov 2026", or null. */
function dateRange(query) {
  const from = parseDate(query.pickup);
  const to = parseDate(query.return);
  if (!from) return null;
  if (!to || to <= from)
    return {
      short: `from ${day(from)} ${from.getUTCFullYear()}`,
      long: `Pick-up ${longDay(from)}`,
    };
  const days = Math.ceil((to - from) / 86400000);
  const sameMonth =
    from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const span = sameMonth
    ? `${from.getUTCDate()}–${day(to)} ${to.getUTCFullYear()}`
    : sameYear
      ? `${day(from)} – ${day(to)} ${to.getUTCFullYear()}`
      : `${day(from)} ${from.getUTCFullYear()} – ${day(to)} ${to.getUTCFullYear()}`;
  return {
    short: `${span} (${days} day${days === 1 ? '' : 's'})`,
    long: `Pick-up ${longDay(from)}, return ${longDay(to)}`,
  };
}

const money = (n) => `RM${Number(n || 0).toLocaleString('en-MY', { maximumFractionDigits: 2 })}`;
const absolute = (url) =>
  !url
    ? DEFAULT_IMAGE
    : /^https?:\/\//.test(url)
      ? url
      : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`;

async function getCar(id) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !UUID.test(id)) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/bubatrent_booking_cars?id=eq.${id}&select=name,plate_number,price_per_day,seats,transmission,fuel_type,image_url,is_available`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(2500),
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

function carFacts(car) {
  return [
    car.plate_number,
    `${money(car.price_per_day)}/day`,
    car.seats ? `${car.seats} seats` : null,
    car.transmission,
    car.fuel_type,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** { title, description, image } for a path and its query. */
export async function describe(path, query = {}) {
  const dates = dateRange(query);
  let m;

  if (path === '/' || path === '') {
    if (dates)
      return {
        title: `Cars & vans free ${dates.short} · Rent2Go`,
        description: `${dates.long}. Tap to see which cars and vans are free on these dates and book.`,
      };
    return null;
  }

  if ((m = path.match(/^\/cars\/([^/]+)\/?$/))) {
    const car = await getCar(m[1]);
    if (!car)
      return {
        title: 'Car for rent · Rent2Go',
        description: 'See the car, its price and photos, and book.',
      };
    const closed = car.is_available === false;
    return {
      title: dates
        ? `${car.name} · ${dates.short}`
        : `${car.name} · ${money(car.price_per_day)}/day`,
      description: `${carFacts(car)}.${dates ? ` ${dates.long}.` : ''} ${
        closed ? 'Not open for booking right now.' : 'Tap to check the dates and book.'
      }`,
      image: absolute(car.image_url),
      imageAlt: car.name,
    };
  }

  if ((m = path.match(/^\/checkout\/([^/]+)\/?$/))) {
    const car = await getCar(m[1]);
    const name = car?.name || 'your car';
    return {
      title: `Book ${name}${dates ? ` · ${dates.short}` : ''}`,
      description: `${car ? `${carFacts(car)}. ` : ''}${dates ? `${dates.long}. ` : ''}Sign in, check the price and pay the deposit to confirm.`,
      image: car ? absolute(car.image_url) : undefined,
      imageAlt: car?.name,
    };
  }

  if ((m = path.match(/^\/booking\/([^/]+)\/(agreement|invoice|confirmation|documents)\/?$/))) {
    const ref = UUID.test(m[1]) ? m[1].slice(0, 8).toUpperCase() : '';
    const tag = ref ? ` · Booking ${ref}` : '';
    switch (m[2]) {
      case 'agreement':
        return {
          title: `Rental agreement${tag}`,
          description:
            'Read and sign your Rent2Go rental agreement before pick-up. Sign in with the account you booked with.',
        };
      case 'invoice':
        return {
          title: `Invoice${ref ? ` INV-${ref}` : ''} · Rent2Go`,
          description: 'Your Rent2Go invoice: rent, deposit and payments for this booking.',
        };
      case 'documents':
        return {
          title: `Upload your documents${tag}`,
          description: 'Upload your IC and driving licence for this Rent2Go booking.',
        };
      default:
        return {
          title: `Your booking${tag} · Rent2Go`,
          description: 'Your booking details, deposit and what to do next.',
        };
    }
  }

  if ((m = path.match(/^\/admin\/?(.*?)\/?$/))) {
    const rest = m[1];
    let section = ADMIN_PAGES[rest];
    let mm;
    if (!section && (mm = rest.match(/^bookings\/([0-9a-f-]{36})$/i)))
      section = `Booking ${mm[1].slice(0, 8).toUpperCase()}`;
    if (!section && /^cars\/[^/]+\/history$/.test(rest)) section = 'Vehicle history';
    return {
      title: `Rent2Go admin · ${section || 'Admin'}`,
      description: 'For Rent2Go admins. Sign in to open it.',
    };
  }

  const page = PAGES[path.replace(/\/$/, '')];
  if (page) return { title: page[0], description: page[1] };
  return null;
}

function metaTags(url, d) {
  const image = d.image || DEFAULT_IMAGE;
  const alt = d.imageAlt || d.title;
  const tags = [
    `<title>${esc(d.title)}</title>`,
    `<meta name="description" content="${esc(d.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Rent2Go" />`,
    `<meta property="og:title" content="${esc(d.title)}" />`,
    `<meta property="og:description" content="${esc(d.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:alt" content="${esc(alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(d.title)}" />`,
    `<meta name="twitter:description" content="${esc(d.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ];
  if (image === DEFAULT_IMAGE)
    tags.push(
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />'
    );
  return tags.join('\n    ');
}

let indexHtml = null;
async function getIndex(host) {
  if (indexHtml) return indexHtml;
  try {
    const res = await fetch(`https://${host}/index.html`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) indexHtml = await res.text();
  } catch {
    // fall back to a bare page below
  }
  return indexHtml;
}

/** The page with its own tags in place of the site-wide ones. */
export function render(html, url, d) {
  const tags = metaTags(url, d);
  if (!html)
    return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    ${tags}\n  </head>\n  <body><a href="${esc(url)}">${esc(d.title)}</a></body>\n</html>\n`;
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(
      /<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[\s\S]*?\/?>\s*/gi,
      ''
    )
    .replace(/<\/head>/i, `  ${tags}\n  </head>`);
}

export default async function handler(req, res) {
  const raw = typeof req.query.path === 'string' ? req.query.path : '/';
  const path = `/${raw.replace(/^\/+/, '')}`.split('?')[0];
  const params = new URLSearchParams();
  for (const k of ['pickup', 'return'])
    if (typeof req.query[k] === 'string') params.set(k, req.query[k]);
  const qs = params.toString();
  const url = `${SITE}${path === '/' ? '' : path}${qs ? `?${qs}` : ''}`;

  const html = await getIndex(req.headers.host || 'www.rent2go.my');
  const d = await describe(path, req.query);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  if (!d) {
    res.status(200).send(
      html ||
        render(null, url, {
          title: 'Rent2Go — Premium Car Rental Malaysia',
          description: 'Browse the fleet, pick your dates and book.',
        })
    );
    return;
  }
  res.status(200).send(render(html, url, d));
}
