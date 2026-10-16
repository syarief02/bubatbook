# Rent2Go — Test Walkthrough

A hands-on checklist for testing the live site from sign-up to return after a change. Each test
says what to do and what you should see.

- How staff use the admin panel: the in-app **User Manual** (`/admin/manual`).
- Setup, database and deploying: [README.md](README.md).

---

## Before you start

- **Accounts**: a test customer (a spare Gmail works) and an admin account.
- **Mark test bookings**: type `E2E TEST - please ignore` in the checkout note. Pick dates a few
  months ahead so real customers aren't blocked.
- **Test images**: any picture will do for receipts and documents. Never upload someone else's
  real IC or licence.
- **Clean up afterwards** (see the last section).
- **Automated checks**, run before any manual testing:

  ```bash
  npm run lint             # code style and mistakes
  npm run build            # production build
  npm run check:security   # what a signed-out visitor can read or change
  ```

---

## Test 1: Sign-up and verification

1. On rent2go.my, sign up with **Google** (or email and password).
2. **Complete Profile** asks for a Malaysian mobile number. Enter it.
3. Click **Verify** in the top bar → **Verify Account**. Enter the IC number and licence expiry,
   upload an IC image and a licence image, fill in the address, and submit.
   ✅ The page scrolls to the top and shows **Verification Pending**.
4. As admin, open the **Dashboard**.
   ✅ **Customers to Verify** includes the new customer. Clicking it opens the Pending list.
5. Open the customer, check the documents, press **Verify Customer**.
   ✅ The customer can now book. An unverified customer, or one with an expired licence, can't.

## Test 2: Booking and deposit (customer)

1. Signed out, pick dates and a car, then press **Sign in to Book**.
   ✅ After signing in, the dates are still there.
2. Press **Book Now · Pay RM… Deposit**, fill in the details (add the test note) and press
   **Continue to Payment**.
   ✅ Deposit = 30% of the rental, at least RM100. Any credit is applied automatically.
3. Upload a receipt and press **Submit Deposit Payment** (or **Confirm Booking** if credit
   covers the deposit).
   ✅ The confirmation page shows **DEPOSIT_PAID** and the 48-hour notice.
   ✅ **Print Receipt** opens a printable receipt.
   ✅ Next Steps doesn't ask a verified customer for ID.
4. **My Bookings** shows the booking with a **Deposit Receipt** link that opens the image.

## Test 3: Checking the deposit and confirming (admin)

1. **Dashboard → Deposits to Check** → open the booking.
2. Press **Confirm** before verifying.
   ✅ It is refused: the deposit has not been verified.
   ✅ On the **Bookings** list the row shows **Check deposit**, not Confirm.
3. **View Receipt** → **✓ Verify**.
   ✅ The deposit line says it is held until the car is returned.
   ✅ The customer's credit does **not** change.
4. Press **Confirm**.
   ✅ Audit Log shows "Deposit verified" and "Booking confirmed" with your name.

**48-hour release (optional):** leave a test deposit unverified for 48 hours.
✅ The booking becomes **EXPIRED** and the car is free again.
✅ **Reactivate → Deposit Paid** (with a reason) brings it back.

## Test 4: Agreement, full payment and pickup

1. **Customer**: My Bookings → **Agreement** → read, sign, tick the box →
   **Tandatangan & Setuju (Sign & Agree)**.
   ✅ The signed view shows dates like "16 Oct 2026, 10:30" and has **Print / Save PDF**.
2. **Admin**: press **Mark Picked Up**.
   ✅ It is refused: the full rental payment hasn't been verified. The deposit doesn't count as
   rent.
3. **Customer**: My Bookings → **Upload your full rental payment receipt (RM…)** → **Upload**.
   ✅ "Full payment receipt submitted — awaiting verification".
   ✅ A **Payment Receipt** link appears.
4. **Admin**: **View Receipt** → **✓ Verify Full Payment**.
   For cash with no receipt, use **✓ Mark Full Payment Received (cash)** instead.
5. **Admin**: **Mark Picked Up**.
   ✅ The status becomes **PICKUP**.

## Test 5: Return with charges (admin)

1. Press **Mark Returned**. In **Return car**, keep today's date and **Add charge** twice:
   - **Late return**, `60`, "6 hours late".
   - **Damage**, `80`, "Scratch on rear bumper".

   ✅ With a RM100 deposit, the summary shows RM100 taken from the deposit, RM0 back to credit,
   and the customer still owes RM40.

2. Press **Mark Returned**.
   ✅ **Return & Charges** lists both charges and "Customer owes RM 40".
   ✅ The deposit line says it was added to credit less charges.
3. Press **Remove** on one charge.
   ✅ A reason is required.
   ✅ The part taken from the deposit goes back to the customer's credit.
4. Choose **Cash** and press **Record Payment**.
   ✅ Nothing is owed any more.
   ✅ **Payment Records** shows a **Charge payment**.
   ✅ **Remove** is no longer offered.
5. **+ Add a charge found later**.
   ✅ The new charge is owed, because the deposit was already settled.
6. **Variant**: on another booking, tick **Hold the deposit until the damage cost is known**.
   ✅ Nothing is credited, and **Settle Deposit** appears. Settle it with a damage charge.
7. **Customer**:
   ✅ My Bookings lists each charge with its note, and any amount owed.
   ✅ The **Invoice** has a "Charges After the Rental" section.
   ✅ The credit balance equals the deposit less the charges taken from it.

## Test 6: Cancelling

1. **Customer**: cancel a booking that is HOLD or DEPOSIT_PAID (**Cancel** → **Yes, Cancel**).
   ✅ Credit applied to the deposit comes back.
   ✅ A verified deposit goes to credit.
2. **Admin**: cancel a CONFIRMED booking.
   ✅ The message says the deposit was added to the customer's credit.
   ✅ A PICKUP booking has no Cancel button.

## Test 7: Counter (walk-in) customers

1. **Customers → Create Customer** with IC, phone, address, licence expiry and both images.
   ✅ The customer is created already verified.
2. **Book for Customer**:
   - **Confirmed**: the deposit is recorded as received.
   - **Deposit Paid** with a receipt: **✓ Verify** is offered.
   - **Deposit Paid** without a receipt: **✓ Mark Deposit Received** is offered.
3. The customer signs in, enters the same mobile number on Complete Profile, and confirms their
   IC.
   ✅ The counter booking appears in their My Bookings.
   ✅ They can open the receipt you uploaded, and sign the agreement.

## Test 8: Credit

1. **Customers** → open a customer → **Add Credit**.
   ✅ Amount, date and a transfer receipt are required.
2. **Deduct Credit** with more than the balance.
   ✅ It is refused.
3. ✅ The customer's balance next to their name updates, and their next checkout applies it.

## Test 9: Documents after the rental

On a RETURNED booking:

1. ✅ Both the customer and the admin can open the deposit receipt, the payment receipt, the
   signed agreement and the invoice.
2. ✅ Another customer can't open them.

## Test 10: Dashboard, Sales and Expenses

1. **Dashboard**:
   ✅ **Rental Revenue** counts rent only.
   ✅ Deposits held, charges collected and charges owed are shown separately.
2. **Sales**:
   ✅ Rental Revenue, Charges Collected, Deposits Received and Deposits Held Now, plus the
   per-car table.
   ✅ Try All Time / Today / This Month / Custom.
3. **Expenses**:
   - **Submit Claim**: car or **Others (General)**, date, amount, description, at least one
     invoice image.
     ✅ It appears under **Pending**.
   - **Upload payment receipt** → **Mark Complete**.
     ✅ It moves to **Completed** and counts in the total.

## Test 11: Audit log and deleting

1. ✅ A booking's **Audit Log** shows every step above, with who did it.
2. **Delete** a test booking that still holds a verified deposit.
   ✅ The deposit goes back to the customer's credit.
   ✅ Their credit history is kept.
   ✅ Admins can't delete credit history.

## Test 12: Mobile uploads

Follow the **Mobile Upload Smoke Test Checklist** in the README on an Android and an iOS phone.

---

## After testing: clean up

- **Each test booking**: open it and press **Delete**. Payments, charges and the agreement go
  with it. The credit history and audit log stay.
- **The test customer's account**: remove it in Supabase (Authentication → Users), together with
  its profile and credit history, or ask the developer. There is no delete-customer button in
  the admin panel.
- **Files**: uploaded receipts and documents for the test bookings can be removed from the
  `customer-documents` storage bucket.
