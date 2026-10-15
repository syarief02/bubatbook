import AdminLayout from '../../components/AdminLayout';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  DollarSign,
  FileSignature,
  HelpCircle,
  History,
  Info,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Shield,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

// The admin handbook. Keep it in step with the pages it describes: button
// names are written exactly as they appear in the admin panel.

const SECTIONS = [
  { id: 'start', title: 'Getting started' },
  { id: 'daily', title: 'Your daily routine' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'cars', title: 'Cars' },
  { id: 'customers', title: 'Customers & verification' },
  { id: 'walk-in', title: 'Walk-in (counter) customers' },
  { id: 'bookings', title: 'Bookings: from hold to return' },
  { id: 'counter-booking', title: 'Book for Customer' },
  { id: 'credit', title: 'Deposits & customer credit' },
  { id: 'documents', title: 'Agreements, receipts & invoices' },
  { id: 'sales', title: 'Sales' },
  { id: 'expenses', title: 'Expenses & claims' },
  { id: 'fleet', title: 'Fleet Settings & Members' },
  { id: 'governance', title: 'Super Group tools' },
  { id: 'logs', title: 'Audit log & Upload Logs' },
  { id: 'help', title: 'Troubleshooting' },
];

// Tailwind only keeps class names it can see whole, so colours are listed here
const NOTE_STYLES = {
  info: {
    box: 'bg-violet-500/10 border-violet-500/20',
    icon: 'text-violet-300',
    title: 'text-violet-200',
  },
  warn: {
    box: 'bg-amber-500/10 border-amber-500/20',
    icon: 'text-amber-400',
    title: 'text-amber-300',
  },
  danger: { box: 'bg-red-500/10 border-red-500/20', icon: 'text-red-400', title: 'text-red-300' },
};

function Section({ id, icon: Icon, iconClass, number, title, children }) {
  return (
    <section id={id} className="glass-card scroll-mt-24">
      <div className="flex items-center gap-3 mb-4 text-white font-semibold text-lg border-b border-white/10 pb-3">
        <Icon className={`w-5 h-5 ${iconClass}`} />
        <h3>
          {number}. {title}
        </h3>
      </div>
      <div className="space-y-4 text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Sub({ children }) {
  return <h4 className="text-white font-semibold pt-2">{children}</h4>;
}

/** A button, tab or field name exactly as it appears on screen. */
function B({ children }) {
  return <span className="text-white font-medium">{children}</span>;
}

function Steps({ children }) {
  return <ol className="list-decimal pl-5 space-y-1.5">{children}</ol>;
}

function Bullets({ children }) {
  return <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;
}

function Note({ tone = 'info', title, children }) {
  const s = NOTE_STYLES[tone];
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`border p-3 rounded-xl flex gap-3 ${s.box}`}>
      <Icon className={`w-5 h-5 shrink-0 ${s.icon}`} />
      <div className="text-xs text-slate-200 space-y-1">
        {title && <strong className={`block ${s.title}`}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

const STATUSES = [
  {
    name: 'HOLD',
    color: 'text-yellow-400',
    meaning: 'The customer is at checkout. The car is held for them for 10 minutes.',
    next: 'Expires by itself if no deposit is submitted.',
  },
  {
    name: 'DEPOSIT_PAID',
    color: 'text-orange-400',
    meaning:
      'The customer uploaded a deposit receipt (or their credit covered the deposit). The car is reserved.',
    next: 'You check the receipt and press ✓ Verify within 48 hours, then Confirm.',
  },
  {
    name: 'CONFIRMED',
    color: 'text-green-400',
    meaning: 'Deposit verified. The booking is secured.',
    next: 'Customer signs the agreement and pays the full rental; you verify it.',
  },
  {
    name: 'PICKUP',
    color: 'text-emerald-400',
    meaning: 'The customer has the car.',
    next: 'Mark Returned when the car comes back.',
  },
  {
    name: 'RETURNED',
    color: 'text-slate-300',
    meaning: "Rental finished. The deposit has gone to the customer's credit.",
    next: 'Deduct any charges or record the refund (section 9).',
  },
  {
    name: 'CANCELLED',
    color: 'text-red-400',
    meaning: 'Cancelled by the customer (only while HOLD or DEPOSIT_PAID) or by an admin.',
    next: 'Credit is returned automatically where due (section 7.7).',
  },
  {
    name: 'EXPIRED',
    color: 'text-slate-400',
    meaning: 'The hold timed out, or the deposit was not verified within 48 hours.',
    next: 'Can be reactivated if the dates are still free (section 7.8).',
  },
];

export default function UserManual() {
  return (
    <AdminLayout title="User Manual">
      <div className="space-y-8 max-w-4xl">
        {/* Welcome */}
        <div className="glass-card bg-gradient-to-br from-violet-500/10 to-indigo-600/10 border-violet-500/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Rent2Go Admin Handbook</h2>
              <p className="text-sm text-slate-400">
                How to run cars, customers, bookings and money in the admin panel.
              </p>
            </div>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Start with <B>Your daily routine</B> if you are new. Button names in <B>white</B> are
            written exactly as they appear on screen. Rules marked <em>enforced</em> are checked by
            the system itself: if a step is missing, the button shows a message instead of going
            ahead.
          </p>
          <nav className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-violet-300 hover:text-white transition-colors"
              >
                {i + 1}. {s.title}
              </a>
            ))}
          </nav>
        </div>

        {/* 1. Getting started */}
        <Section
          id="start"
          number={1}
          icon={Shield}
          iconClass="text-violet-400"
          title="Getting started"
        >
          <p>
            Sign in on rent2go.my with your admin account and click <B>Admin</B> in the top bar.{' '}
            <B>Back to site</B> (top left) returns to the customer website.
          </p>
          <Sub>Who can do what</Sub>
          <Bullets>
            <li>
              <B>Customer</B>: books cars, uploads receipts, signs agreements. Sees only their own
              bookings.
            </li>
            <li>
              <B>Admin</B>: manages cars, bookings, customers, expenses and credit for their
              fleet(s).
            </li>
            <li>
              <B>Super Admin</B>: everything an admin does, plus changing people&apos;s roles. A
              super admin in the Super Group also approves new fleets and change requests, and can
              use <B>View As...</B>.
            </li>
          </Bullets>
          <Sub>Fleets</Sub>
          <p>
            Every car, booking, payment and expense belongs to a fleet (a rental company). If you
            belong to more than one fleet, pick one with the selector at the top of the sidebar; the
            pages then show that fleet&apos;s data. New cars and counter bookings go into the
            selected fleet. Customer profiles and their documents are shared: every admin can see
            every customer.
          </p>
          <p>A fleet&apos;s status decides what its admins can do:</p>
          <Bullets>
            <li>
              <B>Pending Verification</B>: a new fleet waiting for the Super Group. You can set it
              up, but customer verification data and sensitive actions are restricted.
            </li>
            <li>
              <B>Verified</B>: full access.
            </li>
            <li>
              <B>Rejected</B>: the Super Group declined it; the reason is shown at the top of the
              admin pages.
            </li>
            <li>
              <B>Suspended</B>: all changes and sensitive data are blocked until the Super Group
              lifts the suspension.
            </li>
          </Bullets>
        </Section>

        {/* 2. Daily routine */}
        <Section
          id="daily"
          number={2}
          icon={ListChecks}
          iconClass="text-green-400"
          title="Your daily routine"
        >
          <Steps>
            <li>
              Open the <B>Dashboard</B>. Click <B>Deposits to Check</B> and verify or reject each
              receipt (section 7.1). <strong>Do this within 48 hours</strong>: an unverified deposit
              releases the booking automatically.
            </li>
            <li>
              Click <B>Customers to Verify</B> and check each customer&apos;s IC and licence
              (section 5).
            </li>
            <li>
              For today&apos;s pickups, open each booking and make sure the agreement is signed and
              the full payment is verified before handing over the keys (sections 7.3–7.5).
            </li>
            <li>
              For cars coming back, inspect them, press <B>Mark Returned</B>, then deduct any
              charges or record the deposit refund (sections 7.6 and 9).
            </li>
            <li>
              Submit expense claims for money you spent on the cars, and complete claims you have
              paid out (section 12).
            </li>
          </Steps>
        </Section>

        {/* 3. Dashboard */}
        <Section
          id="dashboard"
          number={3}
          icon={LayoutDashboard}
          iconClass="text-indigo-400"
          title="Dashboard"
        >
          <Bullets>
            <li>
              <B>Total Bookings</B>: bookings that are holding, booked, out or returned (not
              cancelled or expired).
            </li>
            <li>
              <B>Active Bookings</B>: holds, deposit paid, confirmed and picked up.
            </li>
            <li>
              <B>Fleet Size</B>: number of cars.
            </li>
            <li>
              <B>Customers to Verify</B>: customers who sent their IC and licence and are waiting
              for you. Click it to open that list.
            </li>
            <li>
              <B>Deposits to Check</B>: deposit receipts waiting for you. Click it to open those
              bookings.
            </li>
            <li>
              <B>Registered Users</B>: customer accounts.
            </li>
          </Bullets>
          <p>
            <B>Rental Revenue</B> is the total of verified rental payments. Deposits are{' '}
            <em>not</em> revenue: they belong to the customer and go back to their credit after the
            rental. <B>Deposits held now</B> shows how much deposit money you are holding for
            bookings that are still running.
          </p>
        </Section>

        {/* 4. Cars */}
        <Section id="cars" number={4} icon={Car} iconClass="text-blue-400" title="Cars">
          <Sub>Adding or editing a car</Sub>
          <p>
            In <B>Cars</B>, click <B>Add Car</B> (or the edit button on a car) and fill in:
          </p>
          <Bullets>
            <li>
              <B>Car Name</B>, <B>Brand</B>, <B>Model</B> (required), <B>Year</B>, <B>Seats</B>,{' '}
              <B>Transmission</B>, <B>Fuel Type</B>.
            </li>
            <li>
              <B>Price/Day (MYR)</B> (required): the daily rate customers pay.
            </li>
            <li>
              <B>Available</B>: set to <B>No</B> to hide the car from the website and stop new
              bookings (the car shows as Unavailable in the list). Existing bookings are not
              affected.
            </li>
            <li>
              <B>Image URL</B>: a link to the car&apos;s photo.
            </li>
            <li>
              <B>Plate Number</B>: printed on the rental agreement and invoice.
            </li>
            <li>
              <B>Features</B>: separated by commas, e.g. &quot;Bluetooth, Rear Camera&quot;.
            </li>
          </Bullets>
          <Sub>How prices are worked out</Sub>
          <Bullets>
            <li>Rental total = number of days × Price/Day.</li>
            <li>
              Deposit = 30% of the rental total, at least RM100. The car&apos;s <B>Deposit</B> field
              is not used.
            </li>
            <li>
              The price is fixed when the booking is made. Changing a car&apos;s price later does
              not change existing bookings.
            </li>
            <li>Customers can book from today up to 6 months ahead.</li>
          </Bullets>
          <Note tone="warn" title="Deleting a car">
            A car that has bookings cannot be deleted. Set <B>Available</B> to No instead.
          </Note>
        </Section>

        {/* 5. Customers */}
        <Section
          id="customers"
          number={5}
          icon={Users}
          iconClass="text-indigo-400"
          title="Customers & verification"
        >
          <Sub>What a customer does before they can book</Sub>
          <Steps>
            <li>Signs up with Google or email and password.</li>
            <li>
              <B>Complete Profile</B>: enters a Malaysian mobile number.
            </li>
            <li>
              <B>Verify Account</B>: enters their IC number and licence expiry date, uploads photos
              of their IC (MyKad) and driving licence, and gives their address. They then see
              &quot;Verification Pending&quot;.
            </li>
            <li>
              After you verify them they can book. An expired licence stops new bookings until they
              update it.
            </li>
          </Steps>
          <Sub>Finding customers</Sub>
          <p>
            <B>Customers</B> has a search box (name, email or phone), a role filter and status
            filters: <B>✅ Verified</B>, <B>❌ Not Verified</B> (nothing sent yet) and{' '}
            <B>⏳ Pending</B> (sent, waiting for you). Click a customer to open their details.
          </p>
          <Sub>Checking documents</Sub>
          <Steps>
            <li>
              Open the customer. Their IC and licence images, IC number, licence expiry, phone and
              address are shown. Opening documents is recorded in the audit log.
            </li>
            <li>
              Check that the IC photo matches the name and IC number, the licence is valid and its
              expiry matches, and both photos are clear.
            </li>
            <li>
              Press <B>Verify Customer</B>. To refuse, press <B>Reject &amp; Re-submit</B>, give a
              reason and confirm: their IC number, documents and licence expiry are cleared and they
              must send them again.
            </li>
          </Steps>
          <p>
            <B>Revoke Verification</B> takes verification away from a verified customer. They
            can&apos;t make new bookings; existing bookings stay.
          </p>
          <Sub>Editing a customer</Sub>
          <p>
            <B>Edit Customer Details</B> changes the name and phone straight away. The IC number,
            address, licence expiry, GDL licence and new IC or licence images are sensitive:
          </p>
          <Bullets>
            <li>
              In the Super Group they are saved immediately, and uploading new IC or licence images
              also marks the customer verified. Only upload documents you have checked.
            </li>
            <li>
              In other fleets they become a change request for the Super Group to approve. Track
              them under <B>My Requests</B>.
            </li>
          </Bullets>
          <Sub>Also on the customer page</Sub>
          <Bullets>
            <li>
              <B>Booking History</B>: the customer&apos;s bookings in your fleet.
            </li>
            <li>
              <B>Deposit Credit</B>: their balance, with <B>Add Credit</B> and <B>Deduct Credit</B>{' '}
              (section 9).
            </li>
            <li>
              Roles (super admins only): <B>Make Admin</B>, <B>Make Super Admin</B>,{' '}
              <B>Demote to Admin</B>, <B>Remove All Admin Access</B>. You can&apos;t change your own
              role.
            </li>
          </Bullets>
        </Section>

        {/* 6. Walk-in customers */}
        <Section
          id="walk-in"
          number={6}
          icon={UserPlus}
          iconClass="text-cyan-400"
          title="Walk-in (counter) customers"
        >
          <p>
            For a customer at the counter who has no account, go to <B>Customers</B> →{' '}
            <B>Create Customer</B>. You need their IC number, a Malaysian phone number, address,
            licence expiry, and photos of the IC and licence. Name, email and licence type are
            optional. The customer is created already verified, without a login. Then book a car for
            them with <B>Book for Customer</B> (section 8).
          </p>
          <Sub>When the customer later signs in</Sub>
          <p>
            If they sign in on rent2go.my (Google or email) and enter the same mobile number on
            Complete Profile, the site asks for their IC number. When it matches, the counter record
            (bookings, credit and verified status) moves into their own account. Only a few wrong IC
            attempts are allowed per day.
          </p>
          <Note tone="warn" title="Counter customers must sign in to sign the agreement">
            Only the customer, signed in to their own account, can sign the rental agreement, and
            pickup needs a signed agreement. Before pickup, send them the agreement link (section
            7.3). They sign in, enter their mobile number and IC to link the counter record, and
            then sign on their phone.
          </Note>
        </Section>

        {/* 7. Bookings */}
        <Section
          id="bookings"
          number={7}
          icon={CalendarDays}
          iconClass="text-violet-400"
          title="Bookings: from hold to return"
        >
          <p>A booking moves through these statuses:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="border border-white/10 p-2 bg-white/5">Status</th>
                  <th className="border border-white/10 p-2 bg-white/5">Meaning</th>
                  <th className="border border-white/10 p-2 bg-white/5">What happens next</th>
                </tr>
              </thead>
              <tbody>
                {STATUSES.map((s) => (
                  <tr key={s.name}>
                    <td className={`border border-white/10 p-2 font-semibold ${s.color}`}>
                      {s.name}
                    </td>
                    <td className="border border-white/10 p-2">{s.meaning}</td>
                    <td className="border border-white/10 p-2">{s.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note title="Enforced rules">
            <p>
              • <B>Confirm</B> only after the deposit is verified.
            </p>
            <p>
              • <B>Mark Picked Up</B> only after the rental agreement is signed <em>and</em> the
              full rental payment is verified. The deposit does not count towards the rent.
            </p>
            <p>
              • <B>Mark Returned</B> only after the car was picked up.
            </p>
          </Note>

          <Sub>7.1 Checking a deposit</Sub>
          <Steps>
            <li>
              Open the booking from <B>Deposits to Check</B> on the Dashboard, or from{' '}
              <B>Bookings</B> → <B>DEPOSIT_PAID</B>.
            </li>
            <li>
              Under <B>Payment Receipts</B> → <B>Deposit Receipt</B>, click <B>View Receipt</B>.
              Check the amount matches the deposit shown, and that the money is in your account.
            </li>
            <li>
              Press <B>✓ Verify</B>. The deposit and its payment are marked verified. Nothing goes
              to the customer&apos;s credit yet: the deposit is held until the car is returned.
            </li>
            <li>
              If the receipt is wrong, press <B>✗ Reject</B> and contact the customer.
            </li>
          </Steps>
          <Note tone="warn" title="48-hour deadline">
            A deposit not verified within 48 hours of being submitted (including a rejected one) is
            released automatically: the booking becomes EXPIRED, the car is freed, and any credit
            the customer used is returned to them. The booking page shows the deadline
            (&quot;Released automatically on …&quot;).
          </Note>
          <Bullets>
            <li>
              A deposit fully covered by the customer&apos;s credit is verified automatically.
            </li>
            <li>
              Paid in cash, with no receipt? Press <B>✓ Mark Deposit Received</B>. It records a cash
              payment.
            </li>
          </Bullets>

          <Sub>7.2 Confirming</Sub>
          <p>
            Press <B>Confirm</B> on the booking page. On the <B>Bookings</B> list, a <B>Confirm</B>{' '}
            button appears once the deposit is verified; before that the row shows{' '}
            <B>Check deposit</B>.
          </p>

          <Sub>7.3 The rental agreement</Sub>
          <Bullets>
            <li>
              Once the booking is confirmed, the customer opens <B>Agreement</B> in My Bookings,
              reads the terms and signs with their finger or mouse. Names, IC, car, dates and prices
              come from the booking, not from what the customer types.
            </li>
            <li>
              If they haven&apos;t signed, the booking page shows <B>Rental Agreement Not Signed</B>
              . Press <B>Copy Agreement Link</B> and send it by WhatsApp.
            </li>
            <li>
              Once signed you see the signature and <B>View Full Agreement</B>, which has a{' '}
              <B>Print / Save PDF</B> button. An agreement can only be signed once.
            </li>
          </Bullets>

          <Sub>7.4 The full rental payment</Sub>
          <p>
            The customer pays the whole rental total separately from the deposit. In My Bookings
            they upload the transfer receipt once the booking is confirmed. Then:
          </p>
          <Bullets>
            <li>
              Click <B>View Receipt</B> under <B>Full Payment</B>, check it, and press{' '}
              <B>✓ Verify Full Payment</B>.
            </li>
            <li>
              If they sent you the receipt another way, use <B>Upload receipt</B> on their behalf,
              then verify it.
            </li>
            <li>
              Paid in cash at the counter? Press <B>✓ Mark Full Payment Received (cash)</B>.
            </li>
          </Bullets>

          <Sub>7.5 Pickup</Sub>
          <p>
            When the customer collects the car, check their IC and licence in person, then press{' '}
            <B>Mark Picked Up</B>. If the agreement isn&apos;t signed or the full payment isn&apos;t
            verified, you get a message saying what is missing.
          </p>

          <Sub>7.6 Return</Sub>
          <Steps>
            <li>Inspect the car: fuel, cleanliness, damage, return time.</li>
            <li>
              Press <B>Mark Returned</B>. Today is recorded as the actual return date, and the
              deposit is added to the customer&apos;s credit automatically. The message shows the
              amount.
            </li>
            <li>
              Charges for late return (RM10/RM15/RM20 per hour), cleaning (RM20) or damage (the
              table in the agreement) are taken with <B>Deduct Credit</B> on the customer (section
              9).
            </li>
            <li>
              Refund the rest as the customer prefers: transfer it and record that with{' '}
              <B>Deduct Credit</B>, or leave it as credit for their next booking. The agreement
              promises the refund within 7 working days.
            </li>
          </Steps>

          <Sub>7.7 Cancelling</Sub>
          <Bullets>
            <li>
              Customers can cancel their own booking while it is HOLD or DEPOSIT_PAID. Admins use{' '}
              <B>Cancel</B> on the booking page (HOLD, DEPOSIT_PAID or CONFIRMED) or on the list. A
              picked-up booking can&apos;t be cancelled.
            </li>
            <li>
              Money is handled automatically. A verified deposit goes back to the customer&apos;s
              credit. If the deposit wasn&apos;t verified yet, only the credit they applied comes
              back; refund any cash part by hand if you received it.
            </li>
            <li>
              The agreement allows a 25% penalty when a customer cancels. Take it with{' '}
              <B>Deduct Credit</B> if you charge it.
            </li>
          </Bullets>

          <Sub>7.8 Expired bookings and reactivation</Sub>
          <p>
            Open the booking and press <B>Reactivate → Deposit Paid</B>, give a reason, and confirm.
            This only works if no other booking has taken those dates. A reactivated booking is not
            released again by the 48-hour rule. Then verify the deposit as usual.
          </p>

          <Sub>7.9 Changing dates</Sub>
          <p>
            <B>Edit Dates</B> works while a booking is HOLD, DEPOSIT_PAID or CONFIRMED, and refuses
            dates that overlap another booking for the same car.
          </p>
          <Note tone="warn">
            Changing dates does not recalculate the price. Agree any difference with the customer
            and record it (for example with Add Credit or Deduct Credit).
          </Note>

          <Sub>7.10 Deleting a booking</Sub>
          <p>
            <B>Delete</B> is for test bookings and mistakes. For a real booking that won&apos;t go
            ahead, use <B>Cancel</B>. Deleting removes the booking, its payments and its signed
            agreement. The customer&apos;s credit history and the audit log are kept. Credit the
            customer applied, or a verified deposit not yet returned, goes back to their credit
            first.
          </p>

          <Sub>7.11 What the booking page shows</Sub>
          <Bullets>
            <li>
              <B>Rental Agreement</B> card: signed or not, with the link or the signature.
            </li>
            <li>
              <B>Rental Details</B>: car, dates, total, deposit, credit applied, actual return date.
            </li>
            <li>
              <B>Customer</B>: name, email, phone and the note from checkout.
            </li>
            <li>
              <B>Payment Receipts</B>: deposit and full payment with their status and buttons. A
              line under the deposit says whether it is still held or when it was added to the
              customer&apos;s credit.
            </li>
            <li>
              <B>Official Invoice / Receipt</B>: <B>View Invoice</B>.
            </li>
            <li>
              <B>Identity Documents</B>: the customer&apos;s IC and licence.
            </li>
            <li>
              <B>Payment Records</B>: every payment with amount, method, status, reference and date.
            </li>
            <li>
              <B>Audit Log</B>: every step, who did it and when (section 15).
            </li>
            <li>
              <B>Timeline</B>: created, last updated and returned dates.
            </li>
          </Bullets>

          <Sub>7.12 The Bookings list</Sub>
          <p>
            Filter by status with the tabs, and search by customer name, email or the start of the
            booking ID. Quick buttons: <B>Confirm</B> (once the deposit is verified),{' '}
            <B>Check deposit</B> and <B>Cancel</B>. Click the arrow to open a booking.
          </p>
        </Section>

        {/* 8. Book for Customer */}
        <Section
          id="counter-booking"
          number={8}
          icon={ClipboardList}
          iconClass="text-orange-400"
          title="Book for Customer"
        >
          <p>
            Use this for bookings made at the counter or over the phone: <B>Customers</B> →{' '}
            <B>Book for Customer</B>.
          </p>
          <Steps>
            <li>
              <B>Select Customer</B>: search by name, phone, IC or email. Verified customers are
              marked ✓. Press <B>Next → Select Car</B>.
            </li>
            <li>Choose the car.</li>
            <li>
              Pick the dates. If they overlap another booking, the page shows which one and
              won&apos;t continue.
            </li>
            <li>
              Set the <B>Deposit</B> (at least RM100). The rental total is days × the car&apos;s
              daily price.
            </li>
            <li>
              <B>Initial Status</B>:
              <Bullets>
                <li>
                  <B>Confirmed</B>: you already have the deposit. It is recorded as received
                  straight away.
                </li>
                <li>
                  <B>Deposit Paid</B>: the deposit still needs checking. Afterwards use{' '}
                  <B>✓ Verify</B> for a receipt, or <B>✓ Mark Deposit Received</B> for cash.
                </li>
              </Bullets>
            </li>
            <li>
              Optionally upload the <B>Deposit Receipt</B>. The customer can open it from their My
              Bookings once they have an account.
            </li>
            <li>Review and create. You land on the booking page.</li>
          </Steps>
          <p>
            Continue as for any booking: agreement (section 6 explains signing for counter
            customers), full payment, pickup and return.
          </p>
        </Section>

        {/* 9. Credit */}
        <Section
          id="credit"
          number={9}
          icon={Wallet}
          iconClass="text-emerald-400"
          title="Deposits & customer credit"
        >
          <p>
            A customer&apos;s <B>credit balance</B> is money you owe them, mostly deposits from
            finished rentals. Customers see it next to their name. At checkout it is applied to the
            next deposit automatically; if it covers the whole deposit, no receipt is needed.
          </p>
          <Sub>When credit is added automatically</Sub>
          <Bullets>
            <li>
              <B>Mark Returned</B>: the booking&apos;s deposit.
            </li>
            <li>A booking cancelled after its deposit was verified: the deposit.</li>
            <li>
              A booking cancelled or released (48 hours) before its deposit was verified: the credit
              the customer had applied to it.
            </li>
            <li>A deleted booking: whatever it still held, as above.</li>
          </Bullets>
          <p>Each of these happens once per booking and appears in the audit log.</p>
          <Sub>Adding and deducting credit by hand</Sub>
          <p>
            Open the customer in <B>Customers</B>; the <B>Deposit Credit</B> section shows the
            balance (and the part from your fleet).
          </p>
          <Bullets>
            <li>
              <B>Add Credit</B>: amount, transaction date and a transfer receipt as proof
              (required), plus a reason. For example, a customer paying in advance.
            </li>
            <li>
              <B>Deduct Credit</B>: amount and a reason. Use it for charges (late return, cleaning,
              damage, cancellation penalty) and to record a deposit you refunded by transfer
              (&quot;Deposit refunded by transfer&quot;). A deduction larger than the balance is
              refused.
            </li>
          </Bullets>
          <Note title="Credit history can't be edited">
            Every change to a balance is kept in the customer&apos;s credit history, and the history
            always adds up to the balance. To correct a mistake, add or deduct the difference with a
            clear reason.
          </Note>
        </Section>

        {/* 10. Documents */}
        <Section
          id="documents"
          number={10}
          icon={FileSignature}
          iconClass="text-cyan-400"
          title="Agreements, receipts & invoices"
        >
          <Bullets>
            <li>
              <B>Receipts</B> (deposit and full payment) open from the booking page (
              <B>View Receipt</B>) and from the customer&apos;s My Bookings (<B>Deposit Receipt</B>,{' '}
              <B>Payment Receipt</B>). The customer can also open receipts you uploaded for their
              booking. Nobody else can. Links work for an hour; reload the page if one stops
              working.
            </li>
            <li>
              <B>Rental agreement</B>: <B>View Full Agreement</B> on the booking page, or{' '}
              <B>Agreement</B> in the customer&apos;s My Bookings. Both have <B>Print / Save PDF</B>
              . Still available after the car is returned.
            </li>
            <li>
              <B>Invoice</B>: available once the deposit or full payment is verified, from{' '}
              <B>View Invoice</B> on the booking page or <B>Invoice</B> in My Bookings. It lists the
              rental and the refundable deposit, and the amount paid. The fleet name and phone come
              from Fleet Settings. <B>Print / Save PDF</B> makes a PDF.
            </li>
            <li>
              Customers can also print a simple booking receipt from <B>View Details</B> →{' '}
              <B>Print Receipt</B>.
            </li>
          </Bullets>
          <Note tone="warn">
            The company registration numbers and address on the invoice are fixed to BuBat
            Resources. If another fleet joins, ask for the invoice to be updated first.
          </Note>
        </Section>

        {/* 11. Sales */}
        <Section id="sales" number={11} icon={DollarSign} iconClass="text-amber-400" title="Sales">
          <p>
            <B>Sales</B> shows, for the selected period (<B>All Time</B>, <B>Today</B>,{' '}
            <B>This Month</B> or <B>Custom</B>, by the date the booking was made):
          </p>
          <Bullets>
            <li>
              <B>Rental Revenue</B>: verified rental payments. This is your income.
            </li>
            <li>
              <B>Deposits Received</B>: verified deposits. Refundable, so not income.
            </li>
            <li>
              <B>Deposits Held Now</B>: deposits for bookings still running, whatever the period.
            </li>
            <li>
              <B>Revenue Per Car</B>: bookings, rental revenue and deposits for each car.
            </li>
          </Bullets>
          <p>Cancelled and expired bookings are not counted.</p>
        </Section>

        {/* 12. Expenses */}
        <Section
          id="expenses"
          number={12}
          icon={Receipt}
          iconClass="text-rose-400"
          title="Expenses & claims"
        >
          <p>Use Expenses to claim back money spent on the fleet (fuel, washing, repairs).</p>
          <Steps>
            <li>
              Click <B>Submit Claim</B>. Choose the <B>Car</B> (or <B>Others (General)</B>), the{' '}
              <B>Expense Date</B>, <B>Amount (RM)</B> and <B>Description</B>, and upload at least
              one invoice image.
            </li>
            <li>
              The claim appears under <B>Pending</B>. Whoever pays it back uploads the payment
              receipt on the claim, which moves it to <B>Completed</B>.
            </li>
            <li>A claim entered by mistake can be deleted, with its images.</li>
          </Steps>
          <p>Filter by car and date. The total at the top counts completed claims only.</p>
        </Section>

        {/* 13. Fleet */}
        <Section
          id="fleet"
          number={13}
          icon={Building2}
          iconClass="text-sky-400"
          title="Fleet Settings & Members"
        >
          <Sub>Fleet Settings</Sub>
          <Bullets>
            <li>
              <B>Fleet Name</B>, <B>Support Email</B>, <B>Support Phone</B> and{' '}
              <B>WhatsApp Number</B>. Customers see the WhatsApp button at checkout and on their
              booking page; the phone number is printed on invoices.
            </li>
            <li>
              You can also create a new fleet. You become its Fleet Admin, and it waits for Super
              Group approval (section 1).
            </li>
          </Bullets>
          <Sub>Members</Sub>
          <p>
            Lists the people in the selected fleet. Fleet Admins and super admins can add a member
            (search by name or email), choose <B>Fleet Admin</B> or <B>Staff</B>, change roles and
            remove members.
          </p>
        </Section>

        {/* 14. Governance */}
        <Section
          id="governance"
          number={14}
          icon={Shield}
          iconClass="text-amber-400"
          title="Super Group tools"
        >
          <p>
            Shown under <B>Governance</B> to super admins in the Super Group.
          </p>
          <Bullets>
            <li>
              <B>Groups</B>: approve or reject new fleets (a reason is required to reject), suspend
              a fleet that breaks the rules, and unsuspend it later.
            </li>
            <li>
              <B>Change Requests</B>: sensitive customer edits from other fleets (section 5). Check
              the old and new values, then approve (the customer record is updated) or reject with a
              reason. Other admins see their own requests under <B>My Requests</B>.
            </li>
            <li>
              <B>View As...</B>: see the panel as a customer, or as the admin of a chosen fleet, to
              check what they see. A banner shows while it is on; press <B>Exit View Mode</B> to
              stop.
            </li>
          </Bullets>
        </Section>

        {/* 15. Logs */}
        <Section
          id="logs"
          number={15}
          icon={History}
          iconClass="text-slate-300"
          title="Audit log & Upload Logs"
        >
          <p>
            Each booking&apos;s <B>Audit Log</B> is written by the system and can&apos;t be edited.
            It records who did each step and when: deposit submitted, verified or rejected;
            confirmed; full payment uploaded or verified; picked up; returned; cancelled;
            reactivated (with the reason); dates or price changed; deposit added to credit; deleted;
            released after 48 hours; and opening the customer&apos;s documents. Steps by the system
            itself show as <B>System</B>.
          </p>
          <p>
            <B>Upload Logs</B> lists file uploads from customers&apos; and admins&apos; devices (IC,
            licence, receipts), with errors, to help when someone says an upload isn&apos;t working.
            Filter by errors or successes, and clear entries older than 7 days.
          </p>
        </Section>

        {/* 16. Troubleshooting */}
        <Section
          id="help"
          number={16}
          icon={HelpCircle}
          iconClass="text-violet-400"
          title="Troubleshooting"
        >
          <div className="space-y-3">
            {[
              [
                '"Cannot confirm yet — the deposit has not been verified"',
                'Verify the deposit receipt first (7.1), or use ✓ Mark Deposit Received for cash.',
              ],
              [
                '"Cannot mark as Picked Up — rental agreement has not been signed yet"',
                'Send the agreement link (7.3). Counter customers must sign in and link their record first (section 6).',
              ],
              [
                '"Cannot mark as Picked Up — the full rental payment (RM …) has not been verified yet"',
                'Verify the full payment receipt, upload it for the customer, or mark cash received (7.4). The deposit does not count.',
              ],
              [
                'A counter booking shows no Verify button for the deposit',
                'There is no receipt to check. Press ✓ Mark Deposit Received once you have the cash (7.1).',
              ],
              [
                '"Those dates overlap with another booking"',
                'Another booking holds the car then. A customer checkout hold clears itself after 10 minutes.',
              ],
              [
                'A customer says they can’t book',
                'Check they are verified and their licence hasn’t expired (Customers). Bookings must start today or later and end within 6 months.',
              ],
              [
                'A booking disappeared from Deposit Paid',
                'Its deposit wasn’t verified within 48 hours, so it was released (EXPIRED). Reactivate it if the dates are free (7.8).',
              ],
              [
                'A receipt or document link doesn’t open',
                'Links work for an hour. Reload the page and try again.',
              ],
              [
                '"Deduct Credit" is refused',
                'The deduction is larger than the customer’s balance.',
              ],
            ].map(([q, a]) => (
              <div key={q} className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-white text-xs font-semibold mb-1">{q}</p>
                <p className="text-xs">{a}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AdminLayout>
  );
}
