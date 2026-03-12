# Rent2Go — Implementation Walkthrough & Test Guide

## ✅ All Features Implemented

Every item from the original plan is complete and deployed. Here's how to test each feature end-to-end:

---

## Test 1: Full Booking Flow (Customer)

> This tests: date persistence, deposit receipt upload, credit application, printable receipt

1. **Open** `bubatbook.vercel.app` (logged out)
2. **Pick dates** → click a car → click **"Book Now"**
3. You'll be redirected to **Login** with dates preserved
4. **Login** → you'll land on **Checkout** with dates pre-filled ✨
5. On Checkout:
   - See deposit breakdown (min RM100 or 30%)
   - If you have credit, it's auto-applied
   - **Upload a receipt image** (any image for testing)
   - Click **"Confirm & Pay Deposit"**
6. You'll see the **Booking Confirmation** page
7. Click **"Print Receipt"** → a new tab opens with a styled receipt + 🖨️ Print button

---

## Test 2: Full Payment Upload (Customer)

1. Go to **My Bookings** (once admin confirms your booking to CONFIRMED)
2. You'll see a purple box: _"Upload your full rental payment receipt"_
3. Upload an image → click **Upload**
4. Status shows _"Full payment receipt submitted — awaiting verification"_

---

## Test 3: Admin Booking Management

> This tests: status progression, date editing, receipt verification, credit return

1. Login as admin → **Admin Dashboard** → **Bookings** → click a booking
2. **Status buttons** at top right: each button progresses the booking:
   - `HOLD → DEPOSIT_PAID → CONFIRMED → PICKUP → RETURNED`
   - Cancel button available for HOLD/DEPOSIT_PAID/CONFIRMED
3. **Edit Dates**: click "Edit Dates" → change dates → Save
4. **Deposit Receipt**: if uploaded, click ✓ Verify or ✗ Reject
5. **Full Payment**: if uploaded, click ✓ Verify
6. **Mark Returned**: sets `actual_return_date` and **auto-returns deposit as credit** to the customer's profile

---

## Test 4: Deposit Credit System

1. After a booking is marked **RETURNED** (Test 3, step 6), the deposit amount is added to the customer's credit
2. Go to **Profile** → you'll see your credit balance
3. **Book again** → on Checkout, credit is auto-deducted from the deposit amount
4. As admin: go to **Customers** → expand a customer → see credit balance → enter an amount + reason → click **"Deduct Credit"**

---

## Test 5: Verification System

1. Login as a new/unverified user → navbar shows yellow **"Verify"** link
2. Go to `/verify` → fill IC number, licence expiry, phone, address (with Malaysian state dropdown), upload IC + licence images
3. As admin: go to **Customers** → expand the user → click **"Verify Customer"**
4. User is now verified. If they update docs later, old verification stays valid until admin approves new docs
5. **Expired licence**: if licence expiry passes, user auto-loses verified status

---

## Test 6: Profile Page

1. Login → click avatar (desktop) or hamburger menu (mobile) → **"My Profile"**
2. Edit name, phone, address → click **"Save"**
3. See verification status, credit balance, recent bookings

---

## Test 7: Admin Sales Dashboard

1. Admin → **Sales** page
2. Toggle filters: Today / This Month / All Time / Custom Range
3. See summary cards: Total Deposits, Full Payments, Cash-in
4. Table shows per-car revenue breakdown

---

## Test 8: Admin Expenses & Claims

1. Admin → **Expenses** page → click **"Submit Claim"**
2. Select a car (or **"Others (General)"** for bulk)
3. Fill date, description, amount, upload invoice images
4. Click **Submit Claim** → appears as Pending
5. To complete: expand the claim → upload payment receipt → click **"Mark Complete"**
6. Filter by Pending/Completed/All or by car

---

## Test 9: Printable Receipt

1. From any booking confirmation page (`/booking/:id/confirmation`)
2. Click **"Print Receipt"** button (bottom right)
3. A new tab opens with a branded HTML receipt:
   - Rent2Go violet gradient header
   - Booking ref, status, vehicle, dates
   - Payment breakdown (deposit, credit applied, full payment)
   - Customer details
   - Contact footer
4. Click 🖨️ Print or Ctrl+P

---

## Build Status

All builds pass: `vite build` → **0 errors**, 1975 modules, ~4.5s build time.

## Files Changed (Summary)

| Category          | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database          | [migration_overhaul.sql](file:///c:/Users/User/OneDrive/Desktop/bubatbook/migration_overhaul.sql), `run_migration.cjs`                                                                                                                                                                                                                                                                                                                                                                                                |
| Auth/Routing      | [useAuth.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/hooks/useAuth.jsx), [App.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/App.jsx), [ScrollToTop.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/components/ScrollToTop.jsx)                                                                                                                                                                                                                                                    |
| Pages (new)       | [Profile.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/Profile.jsx), [admin/Sales.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/admin/Sales.jsx), [admin/Expenses.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/admin/Expenses.jsx)                                                                                                                                                                                                                             |
| Pages (rewritten) | [Checkout.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/Checkout.jsx), [MyBookings.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/MyBookings.jsx), [VerifyAccount.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/VerifyAccount.jsx), [admin/BookingDetail.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/admin/BookingDetail.jsx), [BookingConfirmation.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/BookingConfirmation.jsx) |
| Pages (modified)  | [admin/Dashboard.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/admin/Dashboard.jsx), [admin/Customers.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/admin/Customers.jsx), [CarDetail.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/CarDetail.jsx), [Login.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/pages/Login.jsx)                                                                                                                            |
| Components        | [Navbar.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/components/Navbar.jsx), [Footer.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/components/Footer.jsx), [WhatsAppButton.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/components/WhatsAppButton.jsx), [BookingStatusBadge.jsx](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/components/BookingStatusBadge.jsx)                                                                                                        |
| Utils             | [pricing.js](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/utils/pricing.js)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Styles            | [index.css](file:///c:/Users/User/OneDrive/Desktop/bubatbook/src/index.css) (new badge styles)                                                                                                                                                                                                                                                                                                                                                                                                                        |
