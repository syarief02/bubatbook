# 🚗 Rent2Go — Premium Car Rental Malaysia

> A full-stack car rental platform for the Malaysian market. Customers browse cars, book dates,
> sign the rental agreement on screen, pay a deposit by bank transfer with a receipt upload and
> pay the rental before pickup. Admins verify customers and payments, take counter and phone
> bookings, run the booking from pickup to return (with charges for late returns or damage), manage
> deposits as customer credit, and track rental revenue and expenses, for one or more rental
> companies (fleets).

🌐 **Live:** [rent2go.my](https://rent2go.my) · 📘 **Admin handbook:** in the app at `/admin/manual`

---

## ✨ Features

### Customer

- **Sign in with Google** or email and password. Accounts created by staff at the counter are
  linked by email, or by mobile number plus IC number.
- **Mobile number** required for every customer; Google sign-ups add it before using account pages.
- **Identity verification** with Malaysian IC number and MyKad photo, driving licence photo and
  expiry, a structured address and the bank account deposits are refunded to. An admin approves
  it before the customer can book; an expired licence stops new bookings until the customer
  sends a renewal (new expiry date and licence photo) and an admin approves it.
- **Bank details** (bank, account number, holder name) on the profile, editable by the customer;
  online bookings need them. Every change is in the audit log (last 4 digits only).
- **Browse & book** with a date picker and a server-side availability check, up to 6 months ahead.
- **Checkout** holds the car for 24 hours (or until the pick-up day ends): your info, review, the
  rental agreement, then the deposit (30% of the rental, at least RM100), paid by transfer with a
  receipt upload; existing credit is applied automatically.
- **Rental agreement** signed on screen at checkout, on the customer's own device, before the
  deposit can be paid. Customers can leave and carry on from My Bookings while they wait for the
  bank details. Counter bookings are signed in person on a staff device, or by the customer in My
  Bookings. Print / Save PDF.
- **My Bookings** shows status, the deposit and payment receipts, the full payment upload, the
  agreement, any charges after the rental and the invoice. Customers can cancel while a booking is
  on hold or deposit paid.
- **Invoice** and a printable booking receipt; the credit balance shows next to the name.

### Admin

- **Dashboard**: a "Needs your attention" list (deposit receipts to check, deposits on hold to
  settle, credit owed to customers, licence renewals to review, customers to verify), rental revenue, deposits currently held.
- **Bookings**: the full status flow, with rules enforced by the database. Admins verify deposits
  and full payments (receipt or cash), send the agreement link or take the customer's signature in
  person (**Sign at Counter**), edit dates, reactivate expired bookings, cancel or delete.
  Returning a car takes charges (late return, cleaning, fuel, damage) off the deposit, or holds the
  deposit until damage is priced; anything above the deposit is tracked as owed until collected.
  When a customer pays a workshop for a repair that is ours to pay, staff record it on the
  booking (**Paid to Workshop**) and it comes off what the customer owes. **Change Rental**:
  an agreed price, extend, end early (25% penalty if it's the customer's choice, none for a
  breakdown) or replace the car, each priced and settled by the database. Each booking page lists
  every payment record and a full audit log.
- **Book for Customer** for counter and phone bookings: verified customers with a valid licence
  only, deposit pre-filled from the online rule, optional use of the customer's credit, notes.
  Saved in one server step that prices the booking and records the deposit.
- **Create Customer** for walk-ins: IC, licence and address checked by staff, so the customer is
  verified when created; bank details optional. They need no account to rent; if they sign up later, their record links
  to it.
- **Customers**: check documents, verify, reject or revoke, approve or reject licence renewals, edit details (sensitive edits go to
  the Super Group as change requests), manage roles, add or deduct credit, see booking history.
- **Sales**: rental revenue, charges, expenses paid and profit, kept separate from refundable
  deposits; per car (with plate), with date filters (rentals by pickup date, expenses by expense
  date).
- **Expenses & claims**: claims per car or general, with invoice images, paid with a payment
  receipt. Checked by the database (amount, date, fleet), locked once paid, and in the audit log.
- **Fleets**: fleet settings and members, approval and suspension of fleets, change requests and
  "View As" for the Super Group.
- **Upload Logs** for diagnosing failed uploads, and the in-app **User Manual**.

### System

- **Two-part payment**: deposit, then the full rental before pickup, each with its own receipt.
- **Deposits as credit**: a verified deposit is held during the rental and goes to the customer's
  credit when the car is returned, less any charges (or when the booking is cancelled after
  verification). Credit is applied to the next deposit automatically. The credit ledger is
  append-only.
- **Charges after the rental**: staff enter each charge (amount typed by staff, note shown to the
  customer). Charges come off that booking's deposit; the rest is owed and recorded when paid.
  The deposit can be held after the return until a repair quote arrives.
- **Long-rental rates**: each fleet sets a discount for 7+ and 30+ days (Fleet Settings), used
  by online and counter bookings and shown on the car page.
- **Rent paid**: each booking tracks the rent received (payments and workshop payments). An
  extension reopens the full payment for the extra rent; a lower price or an early return gives
  the excess back as credit. Sales counts rent received and kept.
- **Paid to the workshop (contra)**: when the customer pays the workshop for a repair that is
  ours to pay, it counts as their payment to us: first off the rental still to pay, then charges
  owed, then the rest to their credit. The rental stays income in full, and the repair becomes a
  paid expense of the car (marked as paid by the customer). The invoice shows it.
- **48-hour release**: a deposit not verified within 48 hours releases the booking (EXPIRED), frees
  the car and returns any credit the customer applied. Counter bookings are not released.
- **Audit trail**: every status and payment change is written to the audit log by the database,
  with who made it.
- **Login redirect** keeps the chosen dates and destination; pages scroll to the top on navigation.

---

## 🛠️ Tech Stack

| Layer          | Technology                                                          |
| -------------- | ------------------------------------------------------------------- |
| **Frontend**   | React 19, React Router 7, TanStack Query 5                          |
| **Styling**    | Tailwind CSS 3, custom glass-morphism design                        |
| **Icons**      | Lucide React                                                        |
| **Dates**      | date-fns 4                                                          |
| **Backend**    | Supabase: PostgreSQL 17, Auth, Storage, Row Level Security, pg_cron |
| **Build**      | Vite 6                                                              |
| **Deployment** | Vercel (pushes to `main` deploy automatically)                      |

---

## 📁 Project Structure

```
src/
├── main.tsx, App.tsx      # Entry point; routes with auth, admin and fleet-status guards
├── index.css              # Global styles, Tailwind, print styles
├── components/
│   ├── AdminLayout.jsx        # Admin sidebar, fleet selector, View As
│   ├── FleetSelector.jsx      # Switch the active fleet
│   ├── GroupStatusGuard.jsx   # Banners/limits for pending, rejected, suspended fleets
│   ├── ViewAsSelector.jsx, ViewAsBanner.jsx   # Super admin "View As"
│   ├── SignatureCanvas.jsx    # Rental agreement signature pad
│   ├── SignedFile.jsx         # Links/images for private files (signed URLs)
│   ├── ReturnCharges.jsx      # Return car dialog and the Return & Charges card
│   ├── WorkshopPayments.jsx   # Paid to Workshop card: repairs the customer paid for us
│   ├── RentalChanges.jsx      # Change Rental card: price, extend, end early, replace car
│   ├── ChargesEditor.jsx      # Rows of charges (type, amount, note)
│   ├── GoogleButton.jsx, Navbar.jsx, Footer.jsx, WhatsAppButton.jsx
│   ├── BookingForm.jsx, DateRangePicker.jsx, PriceCalculator.jsx, CarCard.jsx
│   ├── BookingStatusBadge.jsx, Toast.jsx, LoadingSpinner.jsx, EmptyState.jsx, ErrorBoundary.jsx
│   ├── ScrollToTop.jsx        # Scroll to the top on navigation
│   └── ui/button.tsx          # Shared button
├── hooks/
│   ├── useAuth.jsx            # Session, profile, roles
│   ├── useFleet.jsx           # Fleets the admin belongs to, active fleet
│   ├── ViewAsContext.jsx      # Role simulation for super admins
│   ├── useAdmin.js            # Admin queries: stats, bookings, customers, cars
│   ├── useBookings.js         # Customer bookings, hold, deposit, cancel
│   └── useCars.js             # Public car list and detail
├── lib/
│   ├── supabase.js            # Supabase client
│   ├── storage.js             # Private bucket + signed URLs
│   ├── uploadHelper.js        # Mobile-safe uploads with progress and logging
│   └── utils.js               # cn() class-name helper
├── pages/
│   ├── Home, CarDetail, Checkout, BookingConfirmation, MyBookings
│   ├── RentalAgreement        # Sign (customer, or staff in person) / view / print the agreement
│   ├── Invoice                # Printable invoice
│   ├── Login, Signup, ResetPassword, CompleteProfile, VerifyAccount, Profile
│   ├── DocumentUploadPage, Privacy, NotFound
│   └── admin/
│       ├── Dashboard, Bookings, BookingDetail
│       ├── AdminBookForCustomer   # Book for Customer (counter and phone bookings)
│       ├── Customers, CreateCustomer, Cars, Sales, Expenses
│       ├── FleetSettings, GroupMembers, GroupManagement, ChangeRequests
│       ├── UploadLogs
│       └── UserManual         # Admin handbook; keep in step with the admin pages
└── utils/
    ├── pricing.js             # Rental total and deposit (30%, min RM100)
    ├── revenue.js             # Rental revenue vs deposits for Dashboard and Sales
    ├── charges.js             # Charge types, labels and totals
    ├── workshop.js            # Workshop payments: where each one went
    ├── rent.js                # Rent left to pay, rental changes in words
    ├── dates.js, format.js, phoneUtils.js, search.js, returnTo.js
    └── dbErrors.js            # Friendly messages for database errors

supabase/
├── migrations/            # Timestamped SQL, applied in order (see Deploying)
└── legacy/                # Historical SQL; does not match the live database, never run
scripts/
├── check_security.cjs     # What an anonymous visitor can read or change
└── run_migration.cjs      # Despite the name: prints the latest upload logs (needs the service key)
```

---

## 🗄️ Database

### Tables

| Table                                    | Purpose                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `bubatrent_booking_profiles`             | Users: role, verification, IC/licence, address, bank account, credit balance |
| `bubatrent_booking_cars`                 | Cars per fleet: specs, daily price, availability                             |
| `bubatrent_booking_bookings`             | Bookings: status, dates, prices, deposit and full payment state              |
| `bubatrent_booking_payments`             | Payment records (deposit / full payment / charge, method, reference)         |
| `bubatrent_booking_charges`              | Charges after a rental (late return, cleaning, fuel, damage, other)          |
| `bubatrent_booking_rental_changes`       | Price, extension, early return and car changes to a rental                   |
| `bubatrent_booking_workshop_payments`    | Repairs the customer paid the workshop for us, and where it went             |
| `bubatrent_booking_rental_agreements`    | Signed agreements (terms from the booking; staff if signed in person)        |
| `bubatrent_booking_credit_transactions`  | Credit ledger; always adds up to the balance; append-only                    |
| `bubatrent_booking_audit_logs`           | Who did what; written by triggers and functions; undeletable                 |
| `bubatrent_booking_fleet_groups`         | Fleets (rental companies), status, support contacts                          |
| `bubatrent_booking_fleet_memberships`    | Admin membership and fleet role (Fleet Admin / Staff)                        |
| `bubatrent_booking_change_requests`      | Sensitive customer edits awaiting Super Group approval                       |
| `bubatrent_booking_link_attempts`        | Walk-in account linking attempts (rate limit)                                |
| `bubatrent_booking_upload_logs`          | Upload diagnostics from customer and admin devices                           |
| `bubatrent_booking_expense_claims`       | Expense claims (per car or general); locked once paid                        |
| `bubatrent_booking_expense_images`       | Invoice images per claim                                                     |
| `bubatrent_booking_customer_documents`   | Per-booking identity documents (older flow)                                  |
| `bubatrent_booking_verification_updates` | Licence renewals / document updates waiting for review (and reviewed)        |

Files (IC, licence, receipts) live in the private `customer-documents` storage bucket.

### Server functions and triggers

Anything involving money or status goes through the database, not the browser:

| Function / trigger                                      | What it does                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `bubatrent_create_hold_booking`                         | Checks the customer (verified, bank details) and dates, prices the booking, holds the car          |
| `bubatrent_submit_booking_deposit`                      | Needs the signed agreement; records the deposit and receipt, applies credit, starts the 48 h clock |
| `bubatrent_admin_verify_deposit`                        | Marks the deposit verified (records a cash payment if none)                                        |
| `bubatrent_sign_rental_agreement`                       | Signs once, terms from the booking; by the customer (from checkout) or staff in person             |
| `bubatrent_admin_review_verification_update`            | Approve a licence renewal (new details on the profile) or reject it with a reason                  |
| `bubatrent_admin_create_booking`                        | Book for Customer: checks, prices, applies credit, records the deposit                             |
| `bubatrent_admin_adjust_credit`                         | Add / deduct credit with a ledger entry, never below zero                                          |
| `bubatrent_admin_return_booking`                        | Mark returned with charges off the deposit, or hold the deposit                                    |
| `bubatrent_admin_settle_deposit`                        | Release a held deposit, less charges                                                               |
| `bubatrent_admin_add_booking_charges`                   | Charges found after settling (owed)                                                                |
| `bubatrent_admin_remove_booking_charge`                 | Undo a mistaken charge before any charge payment                                                   |
| `bubatrent_admin_record_charge_payment`                 | Record money collected for what the customer owes                                                  |
| `bubatrent_admin_change_rental_price`                   | An agreed price, with a reason; any excess paid goes to credit                                     |
| `bubatrent_admin_extend_rental`                         | Later return if the car is free; extra rent at the new length rate                                 |
| `bubatrent_admin_end_rental_early`                      | Earlier return; unused days back, less 25% if the customer chose it                                |
| `bubatrent_admin_replace_car`                           | Another car of the fleet from a given day, same price                                              |
| `bubatrent_admin_verify_full_payment`                   | Verify the rental payment; records what's left after workshop payments                             |
| `bubatrent_admin_record_workshop_payment`               | Customer paid a workshop for us: off what they owe; repair as expense                              |
| `bubatrent_admin_remove_workshop_payment`               | Undo a mistaken workshop payment and its expense                                                   |
| `bubatrent_release_unverified_deposits`                 | The 48-hour release (pg_cron every 10 min, and on site activity)                                   |
| `bubatrent_check_availability`                          | Public availability check                                                                          |
| `bubatrent_save_mobile`, `bubatrent_link_walk_in_by_ic` | Mobile number and walk-in account linking                                                          |
| `admin_create_walk_in_customer`                         | Creates a verified counter customer; never overwrites an account                                   |
| `bubatrent_protect_*` triggers                          | Stop customers changing protected fields (role, credit, status…)                                   |
| `bubatrent_track_booking` trigger                       | Status rules, `updated_at`, deposit to credit on return/cancel                                     |
| `bubatrent_audit_booking` trigger                       | Audit entry for every status and payment change                                                    |
| `bubatrent_delete_booking` trigger                      | Gives back held credit and logs before a booking is deleted                                        |
| `bubatrent_check_expense_claim` trigger                 | Expense rules (amount, date, fleet); paid claims are locked                                        |
| `bubatrent_audit_expense_claim` trigger                 | Audit entry when a claim is submitted, paid, changed or deleted                                    |

### Booking status flow

```
HOLD ──────► DEPOSIT_PAID ──────► CONFIRMED ──────► PICKUP ──────► RETURNED
  │               │                    │
  ├─► CANCELLED   ├─► CANCELLED        └─► CANCELLED
  └─► EXPIRED     └─► EXPIRED (deposit not verified within 48 h)
     (hold ran         │
      out, 24 h)       └─► reactivated by an admin ─► DEPOSIT_PAID
```

Enforced by the database for every website request:

- **DEPOSIT_PAID** (online) only after the customer has signed the rental agreement.
- **CONFIRMED** only when the deposit is verified.
- **PICKUP** only when the agreement is signed and the full rental payment is verified (the
  deposit does not count as rent).
- **RETURNED** only after **PICKUP**.

---

## 💰 Payment Flow

```
1. Customer picks a car and dates (availability checked on the server).
2. Checkout places a 24-hour hold (or until the pick-up day ends); the server prices it:
   rental = days × daily rate, deposit = max(RM100, 30% of rental).
   Coming back for the same car and dates returns the same hold.
3. Customer signs the rental agreement on their own device (at least 10 minutes are left to pay).
4. Customer uploads the deposit receipt (credit is applied first; if it covers the whole
   deposit, no receipt is needed). The booking becomes DEPOSIT_PAID with a 48-hour deadline.
5. Admin verifies the deposit, then confirms the booking.
6. Customer uploads the full rental payment receipt.
7. Admin verifies the full payment (or records cash), then marks the car picked up.
8. Admin marks the car returned and enters any charges (late return, cleaning, fuel, damage).
   Charges come off the deposit; the rest of the deposit goes to the customer's credit, and
   anything above the deposit is owed until the admin records the payment. For damage that needs
   a quote, the deposit can be held and settled later.
9. Transfer refunds of the remaining credit are recorded with Deduct Credit.
```

**Counter and phone bookings** start at step 5. Staff choose the customer, car and dates in Book for
Customer; the server prices it the same way. **Confirmed** means staff already have the deposit;
**Deposit Paid** leaves it to Verify (receipt) or Mark Deposit Received (cash). Credit can pay part
or all of the deposit. The customer signs on the staff device (**Sign at Counter**), or in My
Bookings if they have an account, and staff record the full payment as a receipt or cash.

Rental revenue on the Dashboard and Sales pages counts verified rental payments; charges
collected are shown next to it. Sales also subtracts paid expense claims to show profit.
Deposits are shown separately because they are returned, and the part of a deposit paid with
existing credit is not counted as money received again.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with Auth, Storage and PostgreSQL

### Setup

```bash
git clone https://github.com/syarief02/bubatbook.git
cd bubatbook
npm install
cp .env.example .env.local   # then fill in your Supabase keys
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Only `VITE_`-prefixed variables reach the browser. Never commit `.env.local`, and never put the
service-role key, database password or any admin login in a script or file in this repo.

### Development

```bash
npm run dev              # Dev server (http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview the production build
npm run lint             # ESLint, including Prettier formatting
npm run lint:fix         # Fix what ESLint can
npm run format           # Prettier on the whole repo
npm run check:security   # Exits 1 if anonymous visitors can reach protected data (needs .env.local)
```

### Google Sign-in

Configured in the Supabase dashboard, not in code. Until it is set up, the Google button shows an
error.

1. **Google Cloud Console** → APIs & Services → Credentials → Create OAuth client ID (Web
   application). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   Fill in the OAuth consent screen (app name, support email, `rent2go.my`, privacy policy
   `https://www.rent2go.my/privacy`) and publish it.
2. **Supabase → Authentication → Sign In / Providers → Google**: enable, paste the client ID and secret.
3. **Supabase → Authentication → URL Configuration**: Site URL `https://www.rent2go.my`; add
   redirect URLs `https://www.rent2go.my/**`, `https://rent2go.my/**`, `http://localhost:5173/**`.

Google does not provide a phone number, so customers without one are sent to `/complete-profile`
before account pages. Mobile numbers are not SMS-verified (too costly per message in Malaysia).

How accounts link to customers registered at the counter:

- **Same email**: Supabase links the Google login to the existing account automatically
  (admin-created accounts have a confirmed email).
- **Same mobile + IC**: `bubatrent_save_mobile()` tells the page whether a never-used walk-in
  record has that number (without revealing anything about it); the customer then confirms their
  IC number and `bubatrent_link_walk_in_by_ic()` moves that record's bookings, credit and verified
  ID details into their account. Wrong IC guesses are limited to 5 per account and 10 per phone
  number per day; conflicts are left for an admin.

---

## 🚢 Deploying

- **Frontend**: pushing to `main` deploys to Vercel in under a minute.
- **Database**: changes are SQL files in `supabase/migrations/`, applied by hand in timestamp
  order (`supabase db push`, the Supabase SQL editor, or `psql`). Each file's header says what it
  changes and whether it is safe to run before the frontend ships.
- **Order**: apply the migration first, then push the frontend straight after.
- **Rehearse first**: run the migration inside `begin; … rollback;` against the live database to
  confirm it applies cleanly, then run it for real.
- **Afterwards**: run `npm run check:security`.
- **Writing to `auth.users` from SQL** (as `admin_create_walk_in_customer` does): set
  `confirmation_token`, `recovery_token`, `email_change_token_new` and `email_change` to `''`.
  Supabase Auth can't load a row with NULLs there ("Database error loading user"), which breaks
  password reset for that login.
- The direct database host (`db.<ref>.supabase.co`) is IPv6-only. From an IPv4-only network, use
  the **Session pooler** connection string from Supabase → Connect.

---

## ✅ Mobile Upload Smoke Test Checklist

Opening the camera or file picker on a phone sends the page to the background. When it comes
back, supabase-js re-checks the session while holding its auth lock and calls
`onAuthStateChange` listeners. That listener in `useAuth.jsx` must stay synchronous and defer any
Supabase call with `setTimeout`; awaiting a query there deadlocks every later request (the old
"stuck on Saving…" bug).

When testing on Android/iOS, verify:

1. **Size Limit:** Upload an image >15MB. A clear error toast appears.
2. **Format Limit:** Upload a `.heic` or `.heif` image. The "format not supported" toast appears.
3. **Progress:** Upload a valid image (e.g. 2MB JPEG). The toast shows "Step 1" then "Step 2".
4. **Success:** After choosing a photo from the camera or gallery, the form finishes saving and
   does not hang on "Saving...".
5. **Flows to Check:** "Deposit Receipt" (`Checkout.jsx`), "Customer Verification"
   (`VerifyAccount.jsx`), "Full Payment Receipt" (`MyBookings.jsx`) and "Add Credit Receipt"
   (`Customers.jsx`).

---

## 🔒 Security

- **Row Level Security** on every table; profiles are visible only to their owner and admins.
- **Protected columns**: triggers stop customers changing their role, verification, credit,
  booking status, prices or payment flags; only super admins change roles.
- **Money and status in the database**: holds, deposits, verification, agreements and credit go
  through server functions; booking rules are enforced by a trigger; a constraint prevents
  overlapping bookings.
- **Append-only credit ledger** and **undeletable audit log**, both written by the database.
- **Private documents**: IC, licence and receipts are in a private bucket and opened through
  one-hour signed URLs. A customer can open files on their own bookings, including receipts an
  admin uploaded for them; admins can open all.
- **Fleet isolation**: admins only reach the cars, bookings, payments, credit and expenses of
  fleets they belong to (super admins see all); customer profiles are a shared pool.
- **Walk-in customers** get a random password. They sign in with "Forgot password" (if staff
  entered their email) or by linking a new account with mobile number and IC; the creating
  function never overwrites an existing account.
- **Signing in person** is limited to admins of the booking's fleet; the agreement records which
  staff member took it, and the audit log has every signing.
- **Security headers** (`vercel.json`): no framing, `nosniff`, strict referrer and permissions
  policies.
- **Route guards**: signed-in pages redirect to login with `returnTo`; admin pages check the role.
- **IC numbers masked** in admin views.

---

## 👥 Roles

| Role            | Capabilities                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Guest**       | Browse cars and prices                                                                                    |
| **Customer**    | Verify identity, book, pay, sign agreements, manage profile                                               |
| **Admin**       | Run bookings, customers, cars, credit, sales and expenses for their fleet(s)                              |
| **Super Admin** | Everything an admin does, plus roles; in the Super Group also fleet approval, change requests and View As |

Within a fleet, members are **Fleet Admin** (can manage members) or **Staff**.

---

## 🏢 Multi-Tenant Fleets

Each rental company is a **fleet**. Cars, bookings, payments, credit entries and expenses belong
to a fleet; customers are shared. The **Super Group** fleet runs the platform and approves new
fleets (statuses: Pending Verification, Verified, Rejected, Suspended).

- **Switch fleet**: use the selector at the top of the admin sidebar (shown when you belong to
  more than one). Everything you add goes into the selected fleet.
- **Add an admin to a fleet**: select the fleet → **Members** → search by name or email → choose
  **Fleet Admin** or **Staff** → add.
- **Add a car to a fleet**: select the fleet → **Cars** → **Add Car**.
- **Create a new fleet**: **Fleet Settings** → create; you become its Fleet Admin and it waits
  for Super Group approval under **Groups**.

---

## 📱 Design

- Dark theme with glass-morphism cards and a violet/indigo accent palette
- Mobile-first and fully responsive
- Print styles for invoices and signed agreements
- Lucide icons and subtle fade/slide animations

---

## 📷 Car Photos

Car images live in `public/cars/`.

- **Owner's photos** (best): a folder per vehicle, e.g. `public/cars/vqb5567/`, listed by plate
  number in `CAR_GALLERIES` in `src/utils/carPhotos.js`. The car page shows them as a gallery;
  the first one is also the car's main picture (`image_url`). Strip location data (EXIF/GPS)
  from phone photos and resize them (about 1280 px wide) before adding them.
- **Photos of similar vehicles** from Wikimedia Commons (Alza, Vanette), used under CC BY-SA
  licences: the car page shows the author, licence and changes for each, from `PHOTO_CREDITS`
  in the same file.
- **Studio renders** for the rest.

---

## 📧 Contact

- **Company:** Bubat Resources
- **Email:** bubatresources@gmail.com
- **Phone / WhatsApp:** +60 19-496 1568
- **Website:** [rent2go.my](https://rent2go.my)

---

## 📄 License

This project is proprietary software owned by Bubat Resources.
