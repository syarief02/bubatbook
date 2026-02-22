# 🚗 BubatRent — Premium Car Rental Platform

A modern car rental booking system built with React and Supabase, featuring real-time availability checking, hold-based booking with expiry, secure document uploads, and an admin dashboard.

**Live Demo**: [bubatbook.vercel.app](https://bubatbook.vercel.app)

---

## ✨ Features

### Customer
- **Browse fleet** — View all available cars with pricing, specs, and features
- **Date-aware availability** — Real-time availability check before booking
- **10-minute hold system** — Reserve dates while completing checkout; auto-expires if not paid
- **Simulated payment** — Pay 30% deposit to confirm booking
- **Document upload** — Submit driving licence and IC for verification
- **Cancel bookings** — Cancel with two-step confirmation from My Bookings or booking detail
- **Responsive design** — Mobile-first glassmorphism UI with smooth animations

### Admin
- **Dashboard** — Overview of bookings, fleet size, revenue, and pending verifications
- **Manage cars** — Add, edit, delete cars with image URLs, pricing, and feature tags
- **Manage bookings** — Filter by status, confirm paid bookings, cancel bookings
- **Document verification** — View masked customer documents with audit logging

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, Vite 6 |
| Styling | Tailwind CSS 3.4, custom glassmorphism design system |
| Backend | Supabase (Auth, PostgreSQL, Storage, RLS) |
| Icons | Lucide React |
| Dates | date-fns |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
git clone https://github.com/syarief02/bubatbook.git
cd bubatbook
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Database Setup

Run the SQL in `supabase_schema.sql` in your Supabase SQL Editor. This creates:
- `bubatrent_booking_profiles` — User profiles with roles
- `bubatrent_booking_cars` — Car fleet with specs and pricing
- `bubatrent_booking_bookings` — Bookings with status tracking and date overlap prevention
- `bubatrent_booking_payments` — Payment records
- `bubatrent_booking_customer_documents` — Encrypted document storage
- `bubatrent_booking_audit_logs` — Admin action audit trail
- Row Level Security policies on all tables

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel → Settings → Environment Variables.

---

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Navbar.jsx           # Navigation with auth state
│   ├── CarCard.jsx          # Car listing card
│   ├── DateRangePicker.jsx  # Date inputs with validation
│   ├── BookingForm.jsx      # Customer info form
│   ├── PaymentSimulator.jsx # Simulated payment flow
│   ├── PriceCalculator.jsx  # Price breakdown display
│   ├── DocumentUpload.jsx   # Licence/IC upload
│   └── ...
├── hooks/            # Data fetching & state
│   ├── useAuth.jsx          # Auth context & session
│   ├── useBookings.js       # Booking CRUD + hold expiry
│   ├── useCars.js           # Car listing + availability
│   └── useAdmin.js          # Admin operations & stats
├── pages/            # Route pages
│   ├── Home.jsx             # Landing + fleet browser
│   ├── CarDetail.jsx        # Car detail + availability
│   ├── Checkout.jsx         # 3-step checkout flow
│   ├── MyBookings.jsx       # User booking list
│   ├── BookingConfirmation.jsx
│   └── admin/               # Admin dashboard & management
├── utils/            # Helpers
│   ├── dates.js             # Date formatting
│   ├── pricing.js           # Price calculation
│   └── format.js            # Masking, phone formatting
└── lib/
    └── supabase.js          # Supabase client init
```

---

## 🔒 Security

- **Row Level Security (RLS)** on all Supabase tables
- **Admin role** required for management operations
- **Document masking** — Sensitive data shown as `****1234`
- **Audit logging** — All admin document access is logged
- **service_role key** never exposed to the client

---

## 📝 License

This project is private. All rights reserved.
