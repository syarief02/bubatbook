# Rent2Go — Test Walkthrough

A hands-on checklist for testing the live site from sign-up to return after a change. Each test
says what to do and what you should see.

- How staff use the admin panel: the in-app **User Manual** (`/admin/manual`).
- Setup, database and deploying: [README.md](README.md).

---

## Before you start

- **Accounts**: a test customer (a spare Gmail works) and an admin account.
- **Mark test bookings**: type `E2E TEST - please ignore` in the checkout note, or in **Notes** in
  Book for Customer. Name test walk-in customers "E2E TEST …". Pick dates a few months ahead so
  real customers aren't blocked.
- **Test details**: any picture will do for receipts and documents. Never upload someone else's
  real IC or licence. For IC numbers use a made-up one with month 13, e.g. `991301-14-0001`, which
  can't belong to anyone.
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
   upload an IC image and a licence image, fill in the address and the **Bank Account** (bank,
   account number, holder name), and submit.
   ✅ Without the bank details it says what's missing; an account number with letters or under 6
   digits is refused.
   ✅ The page scrolls to the top and shows **Verification Pending**.
   ✅ **Profile** shows the bank account (spaces and dashes removed) with **Edit**.
4. As admin, open the **Dashboard**.
   ✅ **Customers to Verify** includes the new customer. Clicking it opens the Pending list.
5. Open the customer, check the documents, press **Verify Customer**.
   ✅ The customer card shows the **Bank Account** with "Updated …".
   ✅ The customer can now book. An unverified customer, or one with an expired licence, can't.
6. **Licence renewal** (optional): as the customer, **Verify** → **Renew licence or update IC**
   (or, with an expired licence, the form opens by itself). Change the expiry date without a new
   licence photo.
   ✅ It asks for the new licence photo. With the photo: **Update Under Review**.
   ✅ Admin: Dashboard → **Needs your attention** lists it; the customer has a **Renewal** tag and
   **Licence renewal to review** (old → new expiry, new photo).
   ✅ **Reject** with a reason: the customer's Verify page shows the reason and the form again.
   ✅ Send it again, **Approve update**: the profile shows the new expiry; the customer can book.
7. **Existing customer without bank details** (optional): clear them with Edit Customer Details,
   then, as the customer, start a booking.
   ✅ Checkout shows **Add Your Bank Details**; after saving on the profile it goes back to the
   booking.

## Test 2: Booking and deposit (customer)

1. Signed out, pick dates and a car, then press **Sign in to Book**.
   ✅ After signing in, the dates are still there.
2. Press **Book Now · Pay RM… Deposit**, fill in the details (add the test note) and press
   **Continue**, then **Continue to Agreement**.
   ✅ The steps are Your Info → Review → Agreement → Payment.
3. Read the agreement, sign, tick the box → **Tandatangan & Setuju (Sign & Agree)**.
   ✅ It shows your name, IC and phone, the car and plate, the dates, total and deposit.
   ✅ The sign button stays off until you sign and tick the box.
   ✅ The Payment step opens. The bar at the top says **Held for you until** about this time
   tomorrow (or midnight, if pick-up is today), with the time left counting down.
   ✅ Deposit = 30% of the rental, at least RM100. Any credit is applied automatically.
   ✅ For 7 days or more, the car page and checkout show the long-rental discount (10%; 20% for
   30 days or more, as set in Fleet Settings) and the deposit is 30% of the discounted rental.
4. **Leave and come back**: go to **My Bookings**.
   ✅ The booking says **Held for you until …** with a **Continue booking** button.
   ✅ **Continue booking** opens checkout on the Payment step, the timer still counting down
   (no new hold, nothing to sign again).
5. Upload a receipt and press **Submit Deposit Payment** (or **Confirm Booking** if credit
   covers the deposit).
   ✅ The confirmation page shows **DEPOSIT_PAID** and the 48-hour notice.
   ✅ **Print Receipt** opens a printable receipt.
   ✅ Next Steps doesn't ask a verified customer for ID.
6. **My Bookings** shows the booking with a **Deposit Receipt** link that opens the image, and
   an **Agreement** link to the signed copy (dates like "16 Oct 2026, 10:30", **Print / Save
   PDF**).
   ✅ The admin booking page already shows "Signed by … on …" (without "in person").

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

**48-hour release (optional):** leave an online test deposit unverified for 48 hours.
✅ The booking becomes **EXPIRED** and the car is free again.
✅ **Reactivate → Deposit Paid** (with a reason) brings it back.
✅ A counter booking (Test 7) left at Deposit Paid is not released.

## Test 4: Full payment and pickup

The agreement was signed at checkout (Test 2). Signing at the counter is in Test 7.

1. **Admin**: press **Mark Picked Up**.
   ✅ It is refused: the full rental payment hasn't been verified. The deposit doesn't count as
   rent.
2. **Customer**: My Bookings → **Upload your rental payment receipt (RM…)** → **Upload**.
   ✅ "Full payment receipt submitted — awaiting verification".
   ✅ A **Payment Receipt** link appears.
3. **Admin**: **View Receipt** → **✓ Verify Full Payment**.
   For cash with no receipt, use **✓ Mark Full Payment Received (cash)** instead.
4. **Admin**: **Mark Picked Up**.
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

1. **Customers → Create Customer** with IC, phone, address, licence expiry and both images (name
   it "E2E TEST …"). Leave the bank account empty.
   ✅ The customer is created already verified; the card says the bank account is not added.
   ✅ Filling only the bank name is refused: all three bank fields or none.
2. **Book for Customer** (Customers → **Book for Customer**):
   - Search an unverified customer.
     ✅ They show **Not verified**, a warning links to Customers, and **Next → Select Car** stays
     disabled. A customer whose licence has expired shows **Licence expired**.
   - Pick the walk-in, a car and dates.
     ✅ The total is days × the daily price, less the long-rental discount for 7 days or more.
     The deposit starts at 30% of the rental (at least RM100); after you change it, **Use it**
     puts the rule back. Put `E2E TEST` in **Notes**.
   - Type an **Agreed price (optional)** with no **Reason**.
     ✅ It is refused. With a reason, the deposit rule follows the agreed price, and the booking's
     **Change Rental** card and invoice show "Agreed price: …" with the reason.
   - **Review & Confirm** → **Create Booking**.
     ✅ You land on the booking page. The audit log starts with "Booking created by admin".
   - **Confirmed**: the deposit is recorded as received.
   - **Deposit Paid** with a receipt: **✓ Verify** is offered.
   - **Deposit Paid** without a receipt: **✓ Mark Deposit Received** is offered.
   - A customer with credit: **Use the customer's credit** is ticked and shows what is left to
     collect.
     ✅ Their credit goes down by that amount, and comes back if you cancel before the deposit is
     verified.
     ✅ If credit covers the whole deposit, it is recorded as received (payment method "credit").
3. On a confirmed counter booking press **Sign at Counter**.
   ✅ The page says **Signing in person (staff)** and shows the customer's name, IC and phone, not
   yours.
   Sign on your device, tick the box and press **Tandatangan & Setuju (Sign & Agree)**.
   ✅ The signed view says "Signed in person at the counter". **Back to Booking** returns to the
   booking page, which shows "Signed … in person at the counter".
   ✅ The audit log has "Rental agreement signed · in person at the counter".
   ✅ After the full payment is verified (**✓ Mark Full Payment Received (cash)** is fine), **Mark
   Picked Up** works.
4. The customer signs in, enters the same mobile number on Complete Profile, and confirms their
   IC.
   ✅ The counter bookings appear in their My Bookings, with the agreement signed at the counter.
   ✅ They can open the receipts you uploaded, and their credit came with the record.
5. A walk-in created **with an email** (use an inbox you can read): on the sign-in page use
   **Forgot password** with that email.
   ✅ The reset email arrives and they can sign in to the counter record.

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
3. ✅ For a counter customer without an account, **View Full Agreement** and **View Invoice** on
   the booking page print both.

## Test 10: Dashboard, Sales and Expenses

1. **Dashboard**:
   ✅ **Rental Revenue** counts rent only.
   ✅ Deposits held, charges collected and charges owed are shown separately.
2. **Expenses** (mark test claims "E2E TEST …" in the description):
   - **Submit Claim** without an amount, or with tomorrow's date.
     ✅ It is refused.
   - **Submit Claim** for a car: today's date, amount `85.50`, a description, at least one invoice
     image. Then one for **Others (General)** dated the last day of last month.
     ✅ Both appear under **Pending**, and the amount shows as "RM 85.50".
     ✅ Opening a claim shows "Submitted by …".
   - **This Month**.
     ✅ Last month's claim is not listed. The total at the top follows the car and date filters.
   - On the car's claim, **Upload payment receipt** → **Mark Complete**.
     ✅ It moves to **Completed** with "Paid by … on …" and a **Payment Receipt** link that opens.
3. **Sales**:
   ✅ Rental Revenue, Charges Collected, Expenses Paid, Profit, Deposits Received and Deposits
   Held Now. Profit = rent + charges − expenses paid.
   ✅ The per-car table shows each car's plate, expenses and profit; general expenses have their own
   row.
   ✅ A deposit paid partly with credit only counts the money that came in under Deposits
   Received.
   ✅ Try All Time / Today / This Month / Custom. A rental counts by its pickup date: a test booking
   months ahead shows only under All Time or a Custom range that includes its pickup. Expenses
   count by their expense date.
4. **Clean up** the test claims with **Delete**.
   ✅ The claim and its files are removed; the deletion is kept in the audit log.

## Test 11: Audit log and deleting

1. ✅ A booking's **Audit Log** shows every step above, with who did it, including "Booking created
   by admin" for counter bookings and "Rental agreement signed" (with "in person at the counter"
   when signed on a staff device).
2. **Delete** a test booking that still holds a verified deposit.
   ✅ The deposit goes back to the customer's credit.
   ✅ Their credit history is kept.
   ✅ Admins can't delete credit history.

## Test 12: Customer paid a workshop for us (admin)

On a CONFIRMED test booking whose rent isn't paid yet:

1. **Paid to Workshop** → **+ Customer paid a workshop for us**: a workshop name, what was
   repaired, an amount below the rental, today's date and any picture as the bill → **Record
   Workshop Payment**.
   ✅ **Full Payment** shows only the rest of the rental, and says how much was paid to the
   workshop.
   ✅ **Expenses** has the repair for the car, already paid, marked **Paid by the customer to the
   workshop**, with a link to the booking.
2. Press **Remove** next to it, with a reason.
   ✅ **Full Payment** is back to the whole rental and the expense is gone.

## Test 13: Changing a rental (admin)

On a CONFIRMED test booking of a few days with the agreement signed. Leave the rent unpaid:
paid rent that a change gives back goes to the customer's credit history, which can't be
deleted.

1. **Change Rental** → **Change price**, a lower price without a reason.
   ✅ It is refused. With a reason, the card lists "Agreed price: …" and the new price.
2. **Extend** by two days.
   ✅ The extra rent is the price for the new length less the old one (a rental that reaches 7
   days gets the weekly discount on all its days). **Full Payment** shows the new amount.
   ✅ Extending into another booking of the same car is refused and names the last free day.
3. **Replace car** with another available car, ticking **Mark … unavailable**.
   ✅ Before pickup the whole booking moves to the new car. The old car is hidden from the
   website until you set it available again in **Cars**.
4. **End early** two days before the return date, **Customer's choice**.
   ✅ The preview shows the unused days less the 25% penalty on the rental. **Car broke down, no
   replacement** shows the unused days with no penalty.
   ✅ After **End Early** the rental price drops by that amount. (Had the customer paid, the
   overpaid rent would go to their credit, or, for a counter customer without an account, the
   message says to refund it by hand.)
5. ✅ The **Invoice** lists each change and adds up, **My Bookings** lists them for the customer,
   and the signed agreement lists them under "Changes after signing".

Clean up: delete the booking, and make the car you marked unavailable available again.

## Test 14: Mobile uploads

Follow the **Mobile Upload Smoke Test Checklist** in the README on an Android and an iOS phone.

---

## After testing: clean up

- **Each test booking**: open it and press **Delete**. Payments, charges and the agreement go
  with it. The credit history and audit log stay.
- **The test customer's account**: remove it in Supabase (Authentication → Users), together with
  its profile and credit history, or ask the developer. There is no delete-customer button in
  the admin panel. A test walk-in that never linked to an account has a login ending in
  `@bubatrent.local`; remove that too.
- **Files**: uploaded receipts and documents for the test bookings can be removed from the
  `customer-documents` storage bucket: `receipts/<booking id>/`, `profiles/<customer id>/`, and
  for counter bookings also `receipts/admin_…` (deposit receipts from Book for Customer) and
  `verification/<walk-in id>/` (documents from Create Customer, which stay there after linking).
