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
    meaning:
      'The customer is at checkout. The car is held for them for 24 hours (or until the pick-up day ends, if that is sooner) while they sign the rental agreement and pay the deposit. They can leave and carry on from My Bookings, for example while waiting for your bank details on WhatsApp.',
    next: 'The customer signs the agreement, then pays the deposit. Expires by itself if no deposit is submitted in time; press Cancel in Bookings to free the car sooner.',
  },
  {
    name: 'DEPOSIT_PAID',
    color: 'text-orange-400',
    meaning:
      'The customer uploaded a deposit receipt (or their credit covered the deposit), or you made a counter booking that still needs its deposit checked. The car is reserved.',
    next: 'You check the receipt and press ✓ Verify (online bookings: within 48 hours), or ✓ Mark Deposit Received for cash, then Confirm.',
  },
  {
    name: 'CONFIRMED',
    color: 'text-green-400',
    meaning: 'Deposit verified. The booking is secured.',
    next: 'Customer pays the full rental; you verify it. Online customers signed the agreement at checkout; counter customers sign with Sign at Counter.',
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
    meaning:
      "Rental finished. The deposit has gone to the customer's credit less any charges, or is on hold.",
    next: 'Settle a held deposit; collect anything the customer owes (section 7.6).',
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
    meaning: 'The hold timed out, or an online deposit was not verified within 48 hours.',
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
              Open the <B>Dashboard</B> and work through <B>Needs your attention</B>. Verify or
              reject each deposit receipt (section 7.1). <strong>Do this within 48 hours</strong>:
              an unverified deposit releases the booking automatically.
            </li>
            <li>
              Click <B>Customers to Verify</B> and check each customer&apos;s IC and licence
              (section 5).
            </li>
            <li>
              For today&apos;s pickups, open each booking and make sure the agreement is signed and
              the full payment is verified before handing over the keys (sections 7.3–7.5). If the
              customer is with you and hasn&apos;t signed, use <B>Sign at Counter</B>.
            </li>
            <li>
              For cars coming back, inspect them and press <B>Mark Returned</B>, entering any
              charges for late return, cleaning, fuel or damage. Settle deposits you put on hold
              once you have the repair quote (they stay in Needs your attention until you do), and
              record payments for anything owed (section 7.6). Refund credit by transfer to the
              customer&apos;s bank account, or keep it for their next booking.
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
          <p>
            <B>Needs your attention</B>, at the top, appears whenever something is waiting for you.
            Each line opens the list to work through:
          </p>
          <Bullets>
            <li>deposit receipts to check (released after 48 hours if you don&apos;t);</li>
            <li>
              deposits on hold to settle: returned cars whose deposit you held until the damage cost
              is known (opens Bookings with <B>Deposit on hold</B>);
            </li>
            <li>
              credit owed to customers: deposits that went back to their credit, to refund by
              transfer or keep for their next booking (opens Customers with <B>💰 Has Credit</B>);
            </li>
            <li>
              licence renewals to review (opens Customers with <B>🔄 Renewals</B>);
            </li>
            <li>customers to verify.</li>
          </Bullets>
          <p>Below it:</p>
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
            <B>Rental Revenue</B> is the rent received and kept (less anything given back when a
            rental was shortened or made cheaper). Deposits are <em>not</em> revenue: they belong to
            the customer and go back to their credit after the rental. <B>Deposits held now</B>{' '}
            shows how much deposit money you are holding for bookings that are still running or on
            hold. Below it: charges after rentals collected so far, and what customers still owe.
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
            <li>
              Rental total = number of days × Price/Day, less the fleet&apos;s long-rental discount:
              10% off for 7 days or more, 20% off for 30 days or more (change them in Fleet
              Settings, section 13). Because of the bigger discount, 30 days can cost less than 29:
              at RM140/day, 29 days are RM3,654 and 30 days RM3,360.
            </li>
            <li>
              Deposit = 30% of the rental total, rounded up to the ringgit, at least RM100. The
              car&apos;s <B>Deposit</B> field is not used.
            </li>
            <li>
              The price is fixed when the booking is made. Changing a car&apos;s price or the
              discounts later does not change existing bookings. To change one booking&apos;s price,
              use <B>Change price</B> (7.14).
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
              of their IC (MyKad) and driving licence, and gives their address and bank account
              (bank, account number, holder name; deposits are refunded there). They then see
              &quot;Verification Pending&quot;.
            </li>
            <li>
              After you verify them they can book. An expired licence stops new bookings until they
              renew it and you approve the renewal (below). Customers verified before bank details
              were asked for add them once on their profile; checkout sends them there before their
              next booking.
            </li>
          </Steps>
          <Sub>Finding customers</Sub>
          <p>
            <B>Customers</B> has a search box (name, email or phone), a role filter and status
            filters: <B>✅ Verified</B>, <B>❌ Not Verified</B> (nothing sent yet) and{' '}
            <B>⏳ Pending</B> (sent, waiting for you), <B>🔄 Renewals</B> (licence renewals waiting
            for you), plus <B>💰 Has Credit</B> for customers holding credit. Click a customer to
            open their details; each booking in their <B>Booking History</B> opens that booking, and
            one with a deposit on hold says so.
          </p>
          <Sub>Checking documents</Sub>
          <Steps>
            <li>
              Open the customer. Their IC and licence images, IC number, licence expiry, phone,
              address and bank account are shown. Opening documents is recorded in the audit log.
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
          <Sub>Licence renewals</Sub>
          <p>
            When a licence expires, the customer can&apos;t book until they renew it: in{' '}
            <B>Verify Account</B> they enter the new expiry date and upload a photo of the new
            licence (and a new IC photo if their IC number changed). They can also renew early,
            before it expires. The customer gets a <B>Renewal</B> tag, and{' '}
            <B>Needs your attention</B> on the Dashboard lists it.
          </p>
          <Steps>
            <li>
              Open the customer. <B>Licence renewal to review</B> shows the old and new expiry (and
              any new IC number or address) and the new photos.
            </li>
            <li>
              Check the new licence photo matches the customer and the expiry date, then press{' '}
              <B>Approve update</B>: the new details replace the old ones and the customer can book
              again.
            </li>
            <li>
              Or press <B>Reject</B> and give a reason: nothing changes, and the customer sees the
              reason and can send it again.
            </li>
          </Steps>
          <p>
            Both are in the audit log. A licence that has already expired can&apos;t be approved.
          </p>
          <p>
            <B>Revoke Verification</B> takes verification away from a verified customer. They
            can&apos;t make new bookings; existing bookings stay.
          </p>
          <Sub>Editing a customer</Sub>
          <p>
            <B>Edit Customer Details</B> changes the name, phone and bank account straight away
            (every bank change is in the audit log, with the last 4 digits). The IC number, address,
            licence expiry, GDL licence and new IC or licence images are sensitive:
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
            licence expiry, and photos of the IC and licence. Name, email, licence type and bank
            account are optional, but enter the name: it is printed on the agreement and invoice.
            Add the bank account when you can (now, or later with Edit Customer Details): it is
            where you refund the deposit, and the customer needs it to book online. The customer is
            created already verified, without a login they can use yet. Then book a car for them
            with <B>Book for Customer</B> (section 8).
          </p>
          <Sub>When the customer later signs in</Sub>
          <p>
            If they sign in on rent2go.my (Google or email) and enter the same mobile number on
            Complete Profile, the site asks for their IC number. When it matches, the counter record
            (bookings, credit and verified status) moves into their own account. Only a few wrong IC
            attempts are allowed per day. If you entered their email when creating them, they can
            also set a password with <B>Forgot password</B> on the sign-in page and use the counter
            record directly.
          </p>
          <Note title="Counter customers sign the agreement on your device">
            Pickup needs a signed rental agreement. A counter customer doesn&apos;t need an account
            for it: on the booking page press <B>Sign at Counter</B>, check their IC, and hand them
            your phone or tablet to read and sign (section 7.3).
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
            (&quot;Released automatically on …&quot;). Counter bookings made with{' '}
            <B>Book for Customer</B> are never released this way.
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
              Online customers sign at checkout, on their own phone or computer, before they can pay
              the deposit: they read the terms and sign with their finger or mouse. So a booking you
              review already has its signed agreement. Names, IC, car, dates and prices come from
              the booking, not from what the customer types.
            </li>
            <li>
              Counter bookings start unsigned: the booking page shows{' '}
              <B>Rental Agreement Not Signed</B>. Press <B>Copy Agreement Link</B> and send it by
              WhatsApp (a customer with an account signs it in My Bookings), or, with the customer
              in front of you, press <B>Sign at Counter</B>.
            </li>
            <li>
              <B>Sign at Counter</B> opens the agreement with the customer&apos;s name, IC and phone
              and a note that you are signing in person. Check their IC, then hand over your device:
              they read, sign and tick the box. It is saved as the customer&apos;s own agreement,
              marked &quot;signed in person at the counter&quot;, and the audit log records your
              name. Use it only with the customer present. When you are done, <B>Back to Booking</B>{' '}
              returns to the booking page.
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
            <li>
              Did the customer pay a workshop for a repair that is ours to pay, and take it off the
              rental? Record that first (7.13). <B>Full Payment</B> then shows only what is left to
              pay, and verifying it records that amount.
            </li>
            <li>
              Did the rental get dearer after it was paid (<B>Extend</B>, or a higher price, 7.14)?{' '}
              <B>Full Payment</B> opens again for the difference only. The customer uploads a
              receipt for it in My Bookings (while the booking is Confirmed or Picked Up), or you
              record it as above. If it got cheaper, the difference goes to their credit.
            </li>
          </Bullets>

          <Sub>7.5 Pickup</Sub>
          <p>
            When the customer collects the car, check their IC and licence in person, then press{' '}
            <B>Mark Picked Up</B>. If the agreement isn&apos;t signed or the full payment isn&apos;t
            verified, you get a message saying what is missing.
          </p>

          <Sub>7.6 Return, late return and damage</Sub>
          <Steps>
            <li>
              Inspect the car: return time, fuel, cleanliness and damage. Take photos of any damage.
            </li>
            <li>
              Press <B>Mark Returned</B>. In <B>Return car</B>, check the <B>Returned on</B> date.
            </li>
            <li>
              For each charge press <B>Add charge</B>, choose <B>Late return</B>, <B>Cleaning</B>,{' '}
              <B>Fuel</B>, <B>Damage</B> or <B>Other</B>, and type the amount. A note is optional
              (e.g. &quot;6 hours late&quot;) but required for Damage and Other. The
              agreement&apos;s rates are RM10/RM15/RM20 per hour late, RM20 for cleaning, and the
              damage table for damage. Leave the list empty if the car came back on time and in good
              condition.
            </li>
            <li>
              The summary shows the deposit held, the charges, what comes off the deposit, what goes
              back to the customer&apos;s credit, and anything they still owe. Press{' '}
              <B>Mark Returned</B>.
            </li>
          </Steps>
          <Bullets>
            <li>
              <strong>Back before the booked return date?</strong> <B>Mark Returned</B> doesn&apos;t
              change the price. To give back the unused days, use <B>End early</B> (7.14), before or
              after marking it returned. The form reminds you when the date is earlier than booked.
            </li>
            <li>
              Charges come off this booking&apos;s deposit; the rest of the deposit goes to the
              customer&apos;s credit. The customer sees each charge and its note in My Bookings and
              on the invoice.
            </li>
            <li>
              <strong>More than the deposit?</strong> The rest is shown as owed, on the booking
              under <B>Return &amp; Charges</B> and in the customer&apos;s My Bookings. When you
              collect it, enter the amount, choose <B>Cash</B> or <B>Bank transfer</B>, optionally
              attach the receipt, and press <B>Record Payment</B>.
            </li>
            <li>
              <strong>Damage needs a quote?</strong> Tick{' '}
              <B>Hold the deposit until the damage cost is known</B>. Nothing goes to the
              customer&apos;s credit. When you know the cost, press <B>Settle Deposit</B> under{' '}
              <B>Return &amp; Charges</B> and enter the charges there.
            </li>
            <li>
              <strong>Found something later?</strong> <B>+ Add a charge found later</B>. The deposit
              was already settled, so the charge is owed by the customer.
            </li>
            <li>
              <strong>Wrong charge?</strong> Press <B>Remove</B> next to it and give a reason; any
              part taken from the deposit goes back to the customer&apos;s credit. Once a payment
              for charges has been recorded, charges can&apos;t be removed; use <B>Add Credit</B> to
              give money back instead.
            </li>
            <li>
              Refund the rest of the deposit as the customer prefers: transfer it to the{' '}
              <B>Bank Account</B> shown on their customer page and record that with{' '}
              <B>Deduct Credit</B> (&quot;Deposit refunded by transfer&quot;), or leave it as credit
              for their next booking. The agreement promises the refund within 7 working days.
            </li>
          </Bullets>

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
            Edit Dates moves a booking and does not recalculate the price. To make a rental longer
            or shorter, use <B>Extend</B> or <B>End early</B> under <B>Change Rental</B> (7.14):
            they price the change and settle the money. A signed agreement keeps the dates the
            customer signed for.
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
              <B>Rental Agreement</B> card (from DEPOSIT_PAID): if not signed,{' '}
              <B>Copy Agreement Link</B> and <B>Sign at Counter</B>; once signed, the signature, who
              signed and when (with &quot;in person at the counter&quot; if it was signed on your
              device) and <B>View Full Agreement</B>.
            </li>
            <li>
              <B>Rental Details</B>: car, dates, total, deposit, credit applied, actual return date.
            </li>
            <li>
              <B>Customer</B>: name, email, phone and the note from checkout or Book for Customer.
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
              <B>Change Rental</B> (from DEPOSIT_PAID): every change to the price, dates or car, the
              price now and the rent left to pay, with <B>Change price</B>, <B>Extend</B>,{' '}
              <B>End early</B> and <B>Replace car</B> (7.14).
            </li>
            <li>
              <B>Paid to Workshop</B> (from CONFIRMED): repairs the customer paid the workshop for
              us, with the bill, where the money went, and <B>+ Customer paid a workshop for us</B>{' '}
              (7.13).
            </li>
            <li>
              <B>Return &amp; Charges</B> (after the return): a held deposit with{' '}
              <B>Settle Deposit</B>, each charge, what the customer owes with <B>Record Payment</B>,
              and <B>+ Add a charge found later</B>.
            </li>
            <li>
              <B>Payment Records</B>: every payment (deposit, full payment, charge payment) with
              amount, method, status, reference and date.
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

          <Sub>7.13 Customer paid a workshop for us</Sub>
          <p>
            Sometimes a car needs a repair that is ours to pay (a breakdown, a service, wear and
            tear), and the customer pays the workshop and takes it off what they owe us. Record it
            on the booking, so the rental still counts in full, the repair shows as an expense of
            the car, and the customer&apos;s invoice adds up.
          </p>
          <Steps>
            <li>
              Get the workshop&apos;s bill and receipt (showing the car&apos;s plate and that it is
              paid), and the customer&apos;s agreement to the amount in writing (WhatsApp is fine).
              Check with the workshop that nothing is still owed.
            </li>
            <li>
              Open the booking. Under <B>Paid to Workshop</B> press{' '}
              <B>+ Customer paid a workshop for us</B>.
            </li>
            <li>
              Enter the <B>Workshop</B>, <B>What was repaired</B>, the <B>Amount paid</B> and the{' '}
              <B>Date the customer paid</B>, and attach the bill and receipt. The summary shows
              where the money goes. Press <B>Record Workshop Payment</B>.
            </li>
          </Steps>
          <Bullets>
            <li>
              The amount comes off what the customer owes us on this booking, in order: the rental
              still to pay, then charges owed, then the rest goes to their credit balance (refund
              it, or leave it for their next booking).
            </li>
            <li>
              Example: rental RM1,000, workshop RM300. <B>Full Payment</B> shows RM700; verify that
              when they pay. Sales shows RM1,000 rental and a RM300 repair expense for the car.
            </li>
            <li>If it covers the whole rental, the full payment is verified automatically.</li>
            <li>
              Record it before verifying the full payment. If the customer already uploaded a
              receipt for the full rental, verify that first; the workshop amount then goes to their
              credit.
            </li>
            <li>
              The repair is added to <B>Expenses</B> for the car as paid by the customer, with the
              files. It can&apos;t be deleted there.
            </li>
            <li>
              <strong>Entered by mistake?</strong> Press <B>Remove</B> next to it and give a reason.
              Everything it did is undone, and its expense is deleted: the rent it paid is to pay
              again under <B>Full Payment</B>, and the charges it paid are owed again. It can&apos;t
              be removed once the customer has used the credit it gave them; correct the balance
              with <B>Add Credit</B> or <B>Deduct Credit</B> instead.
            </li>
            <li>
              A counter customer without an account has no credit balance, so the amount can be at
              most what they owe on the booking.
            </li>
          </Bullets>
          <Note tone="warn">
            If the customer caused the damage, the repair is their cost. Don&apos;t record it here:
            they still pay the full rental.
          </Note>

          <Sub>7.14 Changing a rental: price, extend, end early, replace car</Sub>
          <p>
            The <B>Change Rental</B> card on the booking page lists every change (the customer sees
            them in My Bookings, on the invoice and on the agreement) and has four buttons:
          </p>
          <Bullets>
            <li>
              <B>Change price</B> (Deposit Paid to Returned): a discount agreed with the customer,
              or a correction. Any admin can do it, but a reason is required and it is shown to the
              customer. If the customer already paid more than the new price, the difference goes to
              their credit; if the price goes up, the rest is to pay under <B>Full Payment</B>. The
              deposit doesn&apos;t change.
            </li>
            <li>
              <B>Extend</B> (Confirmed or Picked Up): choose the new return date. The extra rent is
              worked out at the rate for the new length (so a rental that reaches 7 or 30 days gets
              the long-rental discount); type a different amount if you agreed one, with a reason.
              It is refused if the car is booked by someone else in those days, and tells you the
              last free day. The extra rent shows under <B>Full Payment</B>: record it as usual
              (receipt or cash) when the customer pays.
            </li>
            <li>
              <B>End early</B> (Confirmed, Picked Up or Returned): choose the last day and why.{' '}
              <B>Customer&apos;s choice</B>: the unused days less the agreement&apos;s 25% penalty
              on the rental. <B>Car broke down, no replacement</B>: the unused days, no penalty. You
              can type a different amount (up to the unused days), with a reason. What the customer
              paid above the new price goes to their credit. The rental keeps at least one day; to
              stop it before that, <B>Cancel</B> it. The car is free again after the new date. This
              does not mark the car returned: use <B>Mark Returned</B> as usual.
            </li>
            <li>
              <B>Replace car</B> (Confirmed or Picked Up): choose another car of the fleet. Before
              pickup the whole booking moves to it; once picked up, choose the day it starts. Same
              price. Tick <B>Mark … unavailable</B> to stop the broken car being booked until you
              make it available again in Cars. It is refused if the new car is booked in those days.
              Sales splits the rental between the two cars by days.
            </li>
          </Bullets>
          <Bullets>
            <li>
              A counter customer without an account has no credit balance: when money is due back to
              them, the message tells you to refund it by hand.
            </li>
            <li>
              Each change is listed with its date and time. The Audit Log shows who made it (Dates
              changed, Price changed, Car replaced). Money that goes back is in the customer&apos;s
              credit history.
            </li>
            <li>
              To move a booking to other dates at the same price before pickup, use{' '}
              <B>Edit Dates</B> (7.9) instead.
            </li>
          </Bullets>
          <Note tone="info" title="Example: early return">
            12 days for RM1,512, the customer stops after 3. Unused: 9 days, RM1,134. Penalty: 25%
            of RM1,512 = RM378. Taken off the rental: RM756, which goes back to the customer&apos;s
            credit if they had paid. The rental is now RM756.
          </Note>
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
              <B>Select Customer</B>: search by name, phone, IC or email. Only verified customers
              with a licence that hasn&apos;t expired can be booked, the same rule as online. Others
              are marked <B>Not verified</B> or <B>Licence expired</B>; verify them or update their
              licence on <B>Customers</B> first. Press <B>Next → Select Car</B>.
            </li>
            <li>Choose the car.</li>
            <li>
              Pick the dates. If they overlap another booking, the page shows which one and
              won&apos;t continue. An online checkout in progress holds the car for up to 10
              minutes.
            </li>
            <li>
              Check the price and the <B>Deposit</B>. The price is days × the car&apos;s daily
              price, less the fleet&apos;s long-rental discount (Fleet Settings). For a price agreed
              with the customer, enter the <B>Agreed price</B> and the <B>Reason</B>; the invoice
              shows both. The deposit starts at the online rule (30% of the price, at least RM100);
              you can change it, but not below RM100.
            </li>
            <li>
              If the customer has credit, <B>Use the customer&apos;s credit</B> is ticked: it pays
              the deposit first and the page shows what is left <B>to collect</B>. Untick it to keep
              their credit. If credit covers the whole deposit, it is recorded as received.
            </li>
            <li>
              Optionally add <B>Notes</B> (for example, a phone booking). They show on the booking
              page.
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
            <li>
              Review and press <B>Create Booking</B>. The system checks everything again (customer,
              dates, deposit) and saves the booking, its deposit payment and the audit entry in one
              step; if something is wrong you get a message and the booking is not created. You land
              on the booking page.
            </li>
          </Steps>
          <Bullets>
            <li>
              Counter bookings are not released after 48 hours: a Deposit Paid counter booking waits
              until you verify or cancel it.
            </li>
            <li>
              The audit log starts with <B>Booking created by admin</B> and your name.
            </li>
          </Bullets>
          <p>
            Continue as for any booking: agreement (<B>Sign at Counter</B> if the customer is with
            you, 7.3), full payment, pickup and return.
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
            next deposit automatically; if it covers the whole deposit, no receipt is needed. In{' '}
            <B>Book for Customer</B> you choose whether to use it (section 8).
          </p>
          <Sub>When credit is added automatically</Sub>
          <Bullets>
            <li>
              <B>Mark Returned</B> (or <B>Settle Deposit</B> for a held one): the booking&apos;s
              deposit, less the charges you entered.
            </li>
            <li>A booking cancelled after its deposit was verified: the deposit.</li>
            <li>
              A booking cancelled or released (48 hours) before its deposit was verified: the credit
              the customer had applied to it.
            </li>
            <li>A deleted booking: whatever it still held, as above.</li>
            <li>Removing a charge that was taken from the deposit: that part (7.6).</li>
            <li>
              <B>Change price</B> or <B>End early</B> when the customer had already paid more rent
              than the new price: the difference (7.14).
            </li>
            <li>
              A workshop payment larger than what the customer owed on the booking: the rest (7.13).
            </li>
          </Bullets>
          <p>
            A deposit goes back once per booking. Every change to a balance appears in the
            customer&apos;s credit history with its reason.
          </p>
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
              <B>Deduct Credit</B>: amount and a reason. Use it to record a deposit you refunded by
              transfer (&quot;Deposit refunded by transfer&quot;) or a cancellation penalty. Charges
              for a returned car belong on the booking instead (section 7.6), so the customer sees
              them. A deduction larger than the balance is refused.
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
              . Still available after the car is returned. One signed on your device says
              &quot;Signed in person at the counter&quot;. The signed agreement keeps the car, dates
              and price as signed; changes made afterwards (7.14) are listed below it under{' '}
              <B>Changes after signing</B>, with the return date and rental now. A counter customer
              without an account can&apos;t open My Bookings, so print the agreement and invoice for
              them from the booking page.
            </li>
            <li>
              <B>Invoice</B>: available once the deposit or full payment is verified, from{' '}
              <B>View Invoice</B> on the booking page or <B>Invoice</B> in My Bookings. It lists the
              rental as booked (with its long-rental discount), each change to it (agreed price with
              the reason, extension, early return, replacement car), any rent given back to the
              customer&apos;s credit, the refundable deposit, the amount paid, anything the customer
              paid the workshop for us (and what it was taken off), and any charges after the rental
              (what came off the deposit and what is still owed). The fleet name and phone come from
              Fleet Settings. <B>Print / Save PDF</B> makes a PDF.
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
            <B>This Month</B> or <B>Custom</B>). A rental counts in the period of its pickup date,
            so a booking made today for March shows under March, not Today. Expenses count by their
            expense date. <B>This Month</B> is the whole calendar month.
          </p>
          <Bullets>
            <li>
              <B>Rental Revenue</B>: rent received and kept, including what customers paid a
              workshop for us, less anything given back. This is your income. A rental whose car was
              replaced is split between the cars by days.
            </li>
            <li>
              <B>Charges Collected</B>: charges after rentals (late return, cleaning, fuel, damage)
              received so far, from deposits or paid separately. Also income. Anything still owed is
              shown under it.
            </li>
            <li>
              <B>Expenses Paid</B>: completed expense claims (section 12). Claims still waiting to
              be paid are shown under it.
            </li>
            <li>
              <B>Profit</B>: rental revenue plus charges collected, minus expenses paid.
            </li>
            <li>
              <B>Deposits Received</B>: deposit money that came in. Refundable, so not income. The
              part a customer paid with their credit is not counted again.
            </li>
            <li>
              <B>Deposits Held Now</B>: deposits for bookings still running or on hold, whatever the
              period.
            </li>
            <li>
              <B>Revenue and Expenses Per Car</B>: for each car (with its plate), bookings, rental
              revenue, charges, expenses, profit and deposits. General expenses (Others) have their
              own row.
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
              <B>Expense Date</B> (today or earlier), the <B>Amount (RM)</B> (sen allowed, e.g.
              85.50) and a <B>Description</B>, and upload at least one invoice image.{' '}
              <em>Enforced</em>: the amount and description are required.
            </li>
            <li>
              The claim appears under <B>Pending</B>, with who submitted it. Whoever pays it back
              opens the claim, chooses <B>Upload payment receipt</B> and presses{' '}
              <B>Mark Complete</B>. It moves to <B>Completed</B>, showing who paid it, when, and a{' '}
              <B>Payment Receipt</B> link.
            </li>
            <li>
              A paid claim can&apos;t be changed. If it is wrong, delete it and submit it again. A
              claim entered by mistake can be deleted, with its images.
            </li>
          </Steps>
          <p>
            A repair the customer paid the workshop for (7.13) appears here by itself, already paid,
            marked <B>Paid by the customer to the workshop</B>, with a link to the booking. Remove
            it from the booking, not here.
          </p>
          <p>
            Filter by car and date. The total at the top follows the filters: what was paid, and
            what is still waiting to be paid. Submitting, paying, changing and deleting a claim are
            all recorded in the audit log, with who did it.
          </p>
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
              <B>Long-rental discounts</B>: the percentage off for rentals of 7 days or more and of
              30 days or more (10% and 20% to start). Online and counter bookings use them; the car
              page shows the discount. 0 turns it off. Bookings already made keep their price.
            </li>
            <li>
              Only a Fleet Admin or a super admin can change Fleet Settings; Staff get a message
              saying so.
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
            It records who did each step and when: booking created by admin; deposit submitted,
            verified or rejected; confirmed; rental agreement signed (and whether in person at the
            counter); full payment uploaded or verified, or to pay again after a change; picked up;
            returned; cancelled; reactivated (with the reason); dates or price changed (Edit Dates,
            Change price, Extend, End early); car replaced; deposit added to credit, put on hold or
            settled; charges added or removed; payments received for charges; workshop payments
            recorded or removed; deleted; released after 48 hours; and opening the customer&apos;s
            documents. Steps by the system itself show as <B>System</B>. Expense claims are recorded
            the same way (submitted, paid, changed, deleted, with the amount and who did it), though
            there is no page that lists them yet; ask the developer if you need that history.
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
                'Send the agreement link, or use Sign at Counter with the customer present (7.3).',
              ],
              [
                '"Cannot mark as Picked Up — the full rental payment (RM …) has not been verified yet"',
                'Verify the full payment receipt, upload it for the customer, or mark cash received (7.4). The deposit does not count.',
              ],
              [
                'Book for Customer: Next → Select Car stays grey',
                'The customer is not verified or their licence has expired. Verify them or update the licence expiry on Customers first (section 5).',
              ],
              [
                'A walk-in customer can’t sign in',
                'If you entered their email, they use Forgot password on the sign-in page. Otherwise they sign up, enter the same mobile number and confirm their IC to link the counter record (section 6).',
              ],
              [
                'A counter booking shows no Verify button for the deposit',
                'There is no receipt to check. Press ✓ Mark Deposit Received once you have the cash (7.1).',
              ],
              [
                '"Those dates overlap with another booking"',
                'Another booking holds the car then. An unpaid online checkout (Hold) frees up within 24 hours; press Cancel on it in Bookings to free the car sooner.',
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
              [
                'The charges are more than the deposit',
                'The rest is recorded as owed. Collect it and press Record Payment under Return & Charges (7.6).',
              ],
              [
                '"This claim is already paid and can’t be changed"',
                'Paid claims are locked. Delete the claim and submit it again with the right details (section 12).',
              ],
              [
                '"The expense date can’t be in the future"',
                'Use the date on the invoice. Claims are entered after the money is spent.',
              ],
              [
                'A charge can’t be removed',
                'A payment for charges was already recorded on the booking. Give money back with Add Credit on the customer instead.',
              ],
              [
                'Full Payment shows an amount to pay again after it was verified',
                'The rental was extended or its price went up. Only the difference is to pay; record it as usual (7.4).',
              ],
              [
                '"This car is booked from … Extend to … at the latest, or replace the car"',
                'Another booking starts then. Extend up to the day shown, or move the customer to another car with Replace car and extend that (7.14).',
              ],
              [
                '"That car is booked between … Choose another car"',
                'The replacement car has a booking in those days. Pick another car (7.14).',
              ],
              [
                '"The customer has already used the RM… credit this gave them, so it can’t be removed"',
                'The workshop payment gave them credit they have since spent. Correct it with Add Credit or Deduct Credit instead (7.13).',
              ],
              [
                '"This booking has no customer account, so the RM… left over can’t go to their credit"',
                'A counter customer without an account has no credit balance. Record at most what they owe on the booking and settle the rest with them by hand (7.13).',
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
