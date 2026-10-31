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
    date: '2026-11-01',
    items: [
      {
        kind: 'data',
        title: 'Car history since January 2025: the Alza PRE 4166 and the Veloz VQB 5567',
        text: 'Every 2025 rental of the Alza PRE 4166, and of the Veloz VQB 5567 since it arrived in December 2025, is now on the car’s History and in Customer History: the renter’s name where the receipts show it, each payment checked against the bank statement, and deposits and refunds. Their 2025 repairs, renewals, loan instalments and other costs are there too, with receipts and payment slips, and the Alza’s 2025–26 road tax and insurance are in Car Documents → History. Their 2026 records were already there.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'The Ranger’s road tax and insurance are in Bocah Trading’s expenses',
        text: 'The Ford Ranger VDM 6927’s road tax and insurance renewed on 18 Oct 2026 are now expenses of Bocah Trading, with their receipts, and on the car’s history. They were paid just before the Ranger moved to Bocah.',
        link: '/admin/expenses',
      },
      {
        kind: 'fixed',
        title: 'Receipts on more expenses in vehicle history',
        text: 'Loan instalments, a few older bills and the October GPS renewals now have their receipt or bank screen attached, so Receipt on the car’s history opens it. Only costs with no receipt anywhere (such as a monthly instalment kept in the workbook) still have none.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-30',
    items: [
      {
        kind: 'improved',
        title: 'View a car’s current documents in one click',
        text: 'In Car Documents, each road tax, insurance, Puspakom and GPS date now has a View file button (File 1, File 2… when there are several) that opens its receipt or certificate, so you don’t need to open History.',
        link: '/admin/car-documents',
      },
      {
        kind: 'fixed',
        title: 'A car’s documents show in its new fleet',
        text: 'When a car moves to another fleet, the documents its old fleet recorded now show in the new fleet’s Car Documents and on the car’s vehicle history too: road tax, insurance, Puspakom and GPS with their dates, so the new fleet knows the car is covered before renting it out, and gets the expiry alerts. Their cost stays with the old fleet. VEY 3830 and the Vellfire VJC 5290 in Bocah Trading show theirs again. If a page still shows no documents, reload it.',
        link: '/admin/car-documents',
      },
      {
        kind: 'improved',
        title: 'Open the files of a car’s earlier documents',
        text: 'For a car that moved to your fleet, History in Car Documents now has the files of the documents its old fleet recorded (receipt, certificate, cover note or road tax disc), so you can show them when needed, e.g. after an accident. Only the fleet that recorded a document can remove it.',
        link: '/admin/car-documents',
      },
    ],
  },
  {
    date: '2026-10-29',
    items: [
      {
        kind: 'data',
        title: 'WA 5202 F road tax renewed',
        text: 'The NV200 WA 5202 F has a new road tax, valid 28 Oct 2026 to 15 Mar 2027, with the agent’s receipt and the road tax disc in Car Documents, so its expired road tax alert is gone. Its 29 Oct bills (new battery and the road tax) are in Expenses and on the car’s history.',
        link: '/admin/car-documents',
      },
      {
        kind: 'data',
        title: 'WA 5202 F can be booked again',
        text: 'With its road tax renewed, the NV200 WA 5202 F has valid road tax, insurance, Puspakom and GPS, so it is back on the website for customers to book.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'The Gran Max VEY 3830 is now in Bocah Trading',
        text: 'From October 2026 VEY 3830 belongs to Bocah Trading, the same way as the Vellfire: its October expenses moved with it. Its earlier rentals (including the 3-van rental that ended 13 Oct), expenses and documents stay with BuBat Resources. Its WhatsApp contact is unchanged.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-28',
    items: [
      {
        kind: 'data',
        title: 'Owner’s photos of WB 4690 R',
        text: 'The Gran Max WB 4690 R now has a gallery of the owner’s photos (front, rear, side, cabin and cargo area) instead of the stock picture.',
        link: '/admin/cars',
      },
      {
        kind: 'fixed',
        title: 'Company address hidden on the van photos',
        text: 'The door sticker with the company address is now blurred on the photos of WB 4690 R, W 9490 C and WA 5202 F.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-26',
    items: [
      {
        kind: 'improved',
        title: 'Car links show the plate',
        text: 'A car’s page is now rent2go.my/cars/ plus its plate without spaces, e.g. rent2go.my/cars/vjc5290 for the Vellfire, so links are easy to read and share. Older links with a long code still work and switch to the new address.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'The Vellfire VJC 5290 is now in Bocah Trading',
        text: 'From October 2026 the Vellfire belongs to Bocah Trading, starting fresh: its October expenses and the GPS renewal of 12 Oct moved with it. Its earlier rentals, expenses and documents stay with BuBat Resources. Its WhatsApp contact is unchanged.',
        link: '/admin/cars',
      },
      {
        kind: 'data',
        title: 'Owner’s photos of WA 5202 F',
        text: 'The NV200 WA 5202 F now has a gallery of the owner’s photos (front, rear, cabin and cargo area) instead of the stock picture.',
        link: '/admin/cars',
      },
    ],
  },
  {
    date: '2026-10-25',
    items: [
      {
        kind: 'fixed',
        title: 'Invoice and agreement pages no longer reload themselves',
        text: 'An open invoice or rental agreement kept loading itself again and again, which slowed the website down and, when a load failed, piled up “Failed to load invoice” messages. They now load once. Reload any invoice or agreement tab that was already open.',
      },
    ],
  },
  {
    date: '2026-10-24',
    items: [
      {
        kind: 'data',
        title:
          'Car history since January 2025: VEY 3516, VEY 3830, W 9490 C, WA 5202 F, WB 4690 R and the Vellfire VJC 5290',
        text: 'Every rental of VEY 3516, VEY 3830, W 9490 C, WA 5202 F, WB 4690 R and the Vellfire VJC 5290 since January 2025 is now on the car’s History and in Customer History: the renter’s name where the receipts show it, each payment checked against the bank statement, deposits and refunds, and van exchanges. Runners, Grab and repairs a renter paid for are charges on the booking, matched by the car’s expense. Their repairs, renewals and loan instalments are there too, each with its receipts, payment slip and a link to the Telegram post. Older road tax, insurance, Puspakom and GPS are in Car Documents → History. The other cars follow one by one.',
        link: '/admin/cars',
      },
      {
        kind: 'fixed',
        title: 'Corrections from the latest Telegram messages (BuBat Resources)',
        text: 'A monthly rental settled with the partner is now marked paid, with a note; claims that were paid twice and taken back by contra say so on the expense. Two expenses the import recorded twice are titled “DUPLICATE – delete” so they can be removed in Expenses. The Vellfire’s insurer is now on its Car Documents record.',
        link: '/admin/expenses',
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
