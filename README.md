# 🚗 Rent2Go — Premium Car Rental Malaysia

> A full-stack car rental booking platform built for the Malaysian market. Customers browse cars, book with date selection, pay deposits via receipt upload, and manage their profiles. Admins manage bookings, verify customers, track revenue, and handle expenses.

🌐 **Live:** [bubatbook.vercel.app](https://bubatbook.vercel.app)

---

## ✨ Features

### Customer Features
- **Browse & Book** — Date picker, real-time availability check, per-car pricing
- **Smart Checkout** — Receipt upload for deposits, auto-applied credit, 6-month advance limit
- **Profile** — Edit details, view verification status, credit balance, booking history
- **Verification** — Malaysian IC number, driving licence upload, structured address with state
- **My Bookings** — Track status, upload full payment receipts, cancel bookings, print receipts
- **Printable Receipts** — Branded HTML receipts with payment breakdown + print button

### Admin Features
- **Dashboard** — Quick stats, active bookings, fleet overview
- **Booking Management** — Full status flow (HOLD → DEPOSIT_PAID → CONFIRMED → PICKUP → RETURNED), date editing, receipt verification
- **Customer Management** — Verify/unverify users, view documents, manage deposit credits, role assignment
- **Sales Dashboard** — Revenue tracking with date filters (today/month/custom), per-car breakdown
- **Expense Claims** — Submit claims with invoice images, mark completed with payment receipt, "Others" for general expenses

### System Features
- **Two-Part Payment** — Deposit (min RM100 or 30%) + full rental payment, each with receipt upload
- **Deposit Credit** — Auto-returned on RETURNED, auto-applied on next booking, admin deduction
- **Licence Expiry** — Auto-invalidates verification when licence expires
- **Login Redirect** — Dates and destination preserved through login flow
- **Scroll-to-Top** — Automatic on every page navigation

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router v7 |
| **Styling** | Tailwind CSS, custom glass-morphism design |
| **Icons** | Lucide React |
| **Dates** | date-fns |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, RLS) |
| **Build** | Vite 6 |
| **Deployment** | Vercel |

---

## � Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AdminLayout.jsx      # Admin page wrapper with sidebar
│   ├── BookingForm.jsx       # Booking form with date + customer fields
│   ├── BookingStatusBadge.jsx # Color-coded status badges
│   ├── CarCard.jsx           # Car listing card with date params
│   ├── DateRangePicker.jsx   # Pick-up / return date inputs
│   ├── DocumentUpload.jsx    # File upload component
│   ├── EmptyState.jsx        # Empty state placeholder
│   ├── ErrorBoundary.jsx     # React error boundary
│   ├── Footer.jsx            # Site footer with contacts
│   ├── LoadingSpinner.jsx    # Loading indicator
│   ├── Navbar.jsx            # Navigation with auth state
│   ├── PriceCalculator.jsx   # Price breakdown display
│   ├── ScrollToTop.jsx       # Auto-scroll on route change
│   ├── Toast.jsx             # Toast notification system
│   └── WhatsAppButton.jsx    # Floating WhatsApp button
│
├── hooks/               # Custom React hooks
│   ├── useAdmin.js          # Admin CRUD operations
│   ├── useAuth.jsx          # Auth context + profile management
│   ├── useBookings.js       # Booking CRUD + availability
│   └── useCars.js           # Car listing + detail fetching
│
├── pages/               # Route pages
│   ├── Home.jsx             # Landing page + car grid
│   ├── CarDetail.jsx        # Car detail + booking widget
│   ├── Checkout.jsx         # Deposit payment + receipt upload
│   ├── BookingConfirmation.jsx  # Confirmation + printable receipt
│   ├── MyBookings.jsx       # Customer booking list
│   ├── Profile.jsx          # Customer profile management
│   ├── VerifyAccount.jsx    # IC/licence verification form
│   ├── Login.jsx            # Login with returnTo support
│   ├── Signup.jsx           # Registration
│   ├── DocumentUploadPage.jsx   # Document upload wrapper
│   ├── NotFound.jsx         # 404 page
│   └── admin/
│       ├── Dashboard.jsx        # Admin home with stats
│       ├── Bookings.jsx         # Booking list + filters
│       ├── BookingDetail.jsx    # Full booking management
│       ├── Cars.jsx             # Fleet management (CRUD)
│       ├── Customers.jsx        # User management + credit
│       ├── Sales.jsx            # Revenue dashboard
│       └── Expenses.jsx         # Expense claims system
│
├── utils/               # Utility functions
│   ├── dates.js             # Date formatting helpers
│   ├── format.js            # Masking + text utilities
│   └── pricing.js           # Price calculation (RM100 min deposit)
│
├── lib/
│   └── supabase.js          # Supabase client init
│
├── App.jsx              # Routes + auth wrappers
├── main.jsx             # React entry point
└── index.css            # Global styles + Tailwind
```

---

## 🗄️ Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `bubatrent_booking_profiles` | User profiles, verification, address, deposit credit |
| `bubatrent_booking_cars` | Fleet details, pricing, specs, images |
| `bubatrent_booking_bookings` | Bookings with status flow, payment tracking, dates |
| `bubatrent_booking_payments` | Payment records (deposit/full) with references |
| `bubatrent_booking_customer_documents` | Per-booking identity documents |
| `bubatrent_booking_verification_updates` | Pending document re-submissions |
| `bubatrent_booking_credit_transactions` | Credit movement audit trail |
| `bubatrent_booking_expense_claims` | Expense claims (car-specific or general) |
| `bubatrent_booking_expense_images` | Invoice images per expense claim |
| `bubatrent_booking_audit_logs` | Admin action audit log |

### Booking Status Flow

```
HOLD → DEPOSIT_PAID → CONFIRMED → PICKUP → RETURNED
  ↓         ↓              ↓
CANCELLED  CANCELLED    CANCELLED
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase project with Auth, Storage, and PostgreSQL enabled

### Setup

```bash
# Clone
git clone https://github.com/syarief02/bubatbook.git
cd bubatbook

# Install
npm install

# Environment
cp .env.example .env.local
# Edit .env.local with your Supabase keys
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Migration

```bash
# Run the full migration (requires DATABASE_URL in .env.local)
node run_migration.cjs
```

### Development

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build
npm run preview    # Preview production build
```

---

## 💰 Payment Flow

```
1. Customer selects dates + car
2. Deposit calculated (max of RM100 or 30% of total)
3. Available credit auto-deducted from deposit
4. Customer uploads deposit receipt image
5. Admin verifies deposit receipt
6. At pickup: customer uploads full rental payment receipt
7. Admin verifies full payment
8. On return: deposit auto-returned as credit to customer profile
```

---

## � Security

- **Row Level Security (RLS)** on all Supabase tables
- **Protected Routes** — auth-gated pages redirect to login with returnTo
- **Admin Routes** — role-checked before rendering
- **Verification documents** stored in private Supabase Storage bucket
- **Sensitive data** — IC numbers masked in admin views
- **Audit logging** — all admin actions tracked

---

## 📱 Design

- Dark theme with glass-morphism (frosted glass cards)
- Violet/indigo gradient accent palette
- Fully responsive (mobile-first)
- Smooth micro-animations (fade-in, slide-up)
- Lucide icons throughout

---

## 👥 Roles

| Role | Capabilities |
|------|-------------|
| **Guest** | Browse cars, view pricing |
| **Customer** | Book cars, upload payments, manage profile, verify identity |
| **Admin** | All customer features + manage bookings, verify users, track sales, manage expenses, deduct credits |

---

## 📧 Contact

- **Company:** Bubat Resources
- **Email:** bubatresources@gmail.com
- **WhatsApp:** +60 16-256 9733 (Amira)
- **Website:** [bubatbook.vercel.app](https://bubatbook.vercel.app)

---

## � License

This project is proprietary software owned by Bubat Resources.
