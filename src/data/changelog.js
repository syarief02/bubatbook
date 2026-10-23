// What's New: the changes admins see on /admin/whats-new, newest first.
//
// Add an entry with every update that admins or customers would notice: a new
// page or button, a changed rule, new prices or photos. Write it for the
// admins, not developers: what changed and where to find it. Keep a fleet's
// private details (income, expenses, credit) out: every fleet's admins see
// this page. `link` opens the page it is about.
//
// kind: 'new' (a new page or feature), 'improved', 'fixed', 'rule' (how
// something works now), 'data' (prices, fleets, cars, photos).

export const CHANGELOG = [
  {
    date: '2026-10-24',
    items: [
      {
        kind: 'data',
        title: 'Car history since January 2025: VEY 3516, VEY 3830, W 9490 C, WA 5202 F and WB 4690 R',
        text: 'Every rental of VEY 3516, VEY 3830, W 9490 C, WA 5202 F and WB 4690 R since January 2025 is now on the car’s History and in Customer History: the renter’s name where the receipts show it, each payment checked against the bank statement, deposits and refunds, and van exchanges. Their repairs, renewals and loan instalments are there too, each with its receipts, payment slip and a link to the Telegram post. Older road tax, insurance and Puspakom are in Car Documents → History. The other cars follow one by one.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-23',
    items: [
      {
        kind: 'new',
        title: "What's New",
        text: 'This page. Every update to the website is listed here, newest first. The menu shows a dot when there is something you haven’t seen.',
      },
      {
        kind: 'data',
        title: 'Cars moved between fleets',
        text: 'W 9490 C and VEY 3516 are back in BuBat Resources, and the Ford Ranger VDM 6927 is now in Bocah Trading. Their car documents moved with them; their WhatsApp contact is unchanged.',
        link: '/admin/cars',
      },
      {
        kind: 'improved',
        title: 'User Manual up to date',
        text: 'The manual now covers what fleets share, credit per fleet and the Counter in every section, including Troubleshooting.',
        link: '/admin/manual',
      },
    ],
  },
  {
    date: '2026-10-22',
    items: [
      {
        kind: 'new',
        title: 'The Counter',
        text: 'Record any rental in a few taps: a new booking, a car on rent now (a WhatsApp deal) or a past rental already paid. A name and phone are enough. Cars that are out get Add payment, Mark returned and the rental changes, and chips list overdue returns, rent owed and deposits to refund.',
        link: '/admin/counter',
      },
      {
        kind: 'rule',
        title: 'Credit belongs to the fleet that gave it',
        text: 'A customer’s credit (returned deposits) only pays deposits for that fleet’s cars, and only that fleet can refund or deduct it. Customers see their credit per rental company on My Profile.',
        link: '/admin/customers',
      },
      {
        kind: 'rule',
        title: 'Fleets share customers, not money',
        text: 'Customer History also lists a customer’s rentals with other fleets (dates, car, return, charges; no amounts). Receipts, car documents, booking records, the audit log and upload logs are now for their own fleet only.',
        link: '/admin/customer-history',
      },
      {
        kind: 'new',
        title: 'A WhatsApp contact for each car',
        text: 'Save your own WhatsApp number in Fleet Settings, and choose each car’s WhatsApp contact in Cars → Edit. Customers who pick a car WhatsApp its contact; without one, the fleet’s number.',
        link: '/admin/fleet',
      },
      {
        kind: 'rule',
        title: 'Car documents move with the car',
        text: 'When a car moves to another fleet, its road tax, insurance, Puspakom and GPS records and their alerts go with it.',
        link: '/admin/car-documents',
      },
      {
        kind: 'data',
        title: 'A second fleet: Bocah Trading',
        text: 'Bocah Trading (Iqbal) joined.',
      },
      {
        kind: 'data',
        title: 'New daily rates (BuBat Resources)',
        text: 'Vellfire RM700, Ranger RM380, Veloz RM260, Alza RM230, panel vans RM220 a day; 40% off for 30 days or more. Bookings already made keep their price.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Vellfire gallery',
        text: 'A new photo of the driver’s door and the lit sill plate.',
      },
    ],
  },
  {
    date: '2026-10-21',
    items: [
      {
        kind: 'new',
        title: 'Car Documents with expiry alerts',
        text: 'Record each road tax, insurance, Puspakom and GPS renewal with its receipt. The Dashboard lists documents that have expired or expire within 30 days.',
        link: '/admin/car-documents',
      },
      {
        kind: 'new',
        title: 'Vehicle history and booking records',
        text: 'Each car has a history page, month by month: rentals, payments, expenses and documents. Bookings can keep records such as WhatsApp chat proof and refund slips.',
        link: '/admin/cars',
      },
      {
        kind: 'new',
        title: 'Customer History',
        text: 'Everyone who has rented, with or without an account, grouped by phone number: their rentals, what they paid and what they still owe.',
        link: '/admin/customer-history',
      },
    ],
  },
  {
    date: '2026-10-20',
    items: [
      {
        kind: 'data',
        title: 'Owner’s photos',
        text: 'New photos for the Alza, the NV200 W 9490 C, the Gran Max VEY 3830 and the Vellfire (interior and night shots).',
      },
    ],
  },
  {
    date: '2026-10-19',
    items: [
      {
        kind: 'rule',
        title: 'A day to pay the deposit',
        text: 'A customer at checkout has the car held for 24 hours (or until the pick-up day ends) to sign and pay the deposit, and can carry on from My Bookings.',
      },
      {
        kind: 'rule',
        title: 'Agreement before the deposit',
        text: 'Customers sign the rental agreement at checkout, before paying the deposit.',
      },
      {
        kind: 'new',
        title: 'Licence renewals and bank accounts',
        text: 'Customers can renew their licence and admins review it (🔄 Renewals in Customers). Customers give their bank account when verifying, for deposit refunds.',
        link: '/admin/customers',
      },
      {
        kind: 'new',
        title: 'Needs your attention',
        text: 'The Dashboard lists what to do: deposits to check, documents expiring, deposits on hold, credit owed, renewals and customers to verify.',
        link: '/admin',
      },
    ],
  },
  {
    date: '2026-10-16',
    items: [
      {
        kind: 'new',
        title: 'Change Rental',
        text: 'Change the price, extend, end early or replace the car on a booking. Weekly and monthly long-rental discounts are set in Fleet Settings.',
        link: '/admin/bookings',
      },
      {
        kind: 'new',
        title: 'Counter bookings and Sign at Counter',
        text: 'Book for Customer checks the customer and dates, and the customer can sign the agreement in person.',
      },
      {
        kind: 'new',
        title: 'Workshop payments',
        text: 'Record repairs a customer paid the workshop for, set against what they owe.',
      },
      {
        kind: 'improved',
        title: 'Sales and Expenses',
        text: 'Sales counts rentals by pick-up date. Expenses got fixes for dates, sen, receipts and the audit trail.',
        link: '/admin/sales',
      },
      {
        kind: 'data',
        title: 'Car photos',
        text: 'Owner’s photos for the Veloz (with a gallery on the car page), Vellfire and Ranger.',
      },
    ],
  },
  {
    date: '2026-10-15',
    items: [
      {
        kind: 'new',
        title: 'Charges on return',
        text: 'Add late return, cleaning, fuel or damage charges when a car comes back, or hold the deposit until the repair cost is known.',
      },
      {
        kind: 'rule',
        title: 'Unchecked deposits are released',
        text: 'An online booking whose deposit isn’t verified within 48 hours is released automatically.',
      },
      {
        kind: 'improved',
        title: 'Revenue and the User Manual',
        text: 'Revenue no longer counts deposits, and the admin User Manual was added.',
        link: '/admin/manual',
      },
    ],
  },
  {
    date: '2026-10-14',
    items: [
      {
        kind: 'improved',
        title: 'Security',
        text: 'Each fleet’s admins see only their own fleet’s bookings and money; walk-in customers are created safely; rental agreements are built by the server.',
      },
    ],
  },
  {
    date: '2026-10-11',
    items: [
      {
        kind: 'new',
        title: 'Google sign-in',
        text: 'Customers can sign in with Google. A mobile number is required, and a counter customer is linked to their new account by IC.',
      },
      {
        kind: 'improved',
        title: 'Uploads, privacy and contact number',
        text: 'Uploads no longer hang on phones, documents are private, a privacy policy page was added, and the contact number is +60 19-496 1568.',
      },
    ],
  },
];

/** The newest entry's date (YYYY-MM-DD). */
export const LATEST_CHANGE = CHANGELOG[0]?.date || '';
