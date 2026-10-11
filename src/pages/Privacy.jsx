import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const LAST_UPDATED = '11 October 2026';
const CONTACT_EMAIL = 'bubatresources@gmail.com';
const CONTACT_PHONE = '+60 16-256 9733';

const SECTIONS = [
  {
    title: 'Who we are',
    body: [
      'Rent2Go (rent2go.my) is a car rental service operated by Bubat Resources in Malaysia. This policy explains what personal data we collect, why, and the choices you have, in line with the Personal Data Protection Act 2010.',
    ],
  },
  {
    title: 'What we collect',
    list: [
      'Account details: your name, email address and mobile number. If you sign up with email, your password is stored in encrypted (hashed) form by our login provider; we never see it.',
      'Identity verification: your IC/MyKad number, driving licence details (expiry date and licence class), photos of your IC and driving licence, and your address. Car rental requires us to confirm who is driving our vehicles.',
      'Bookings and payments: the car, dates and prices of your bookings, payment receipts you upload, and your deposit credit balance. Payments are made by bank transfer; we do not collect card details.',
      'Rental agreements: the signature you draw when signing an agreement, together with the agreement details.',
      'Technical information: when you upload a file we record basic device and browser details to troubleshoot failed uploads. We keep you signed in using your browser’s local storage. We do not use advertising or tracking cookies.',
    ],
  },
  {
    title: 'Signing in with Google',
    body: [
      'If you choose to sign in with Google, Google shares your name, email address and profile picture with us. We use them only to create your Rent2Go account, sign you in, and link your login to an account our staff created for you with the same email address.',
      'We do not access your contacts, files, calendar or any other Google data. We do not sell Google user data, use it for advertising, or share it with anyone except the service providers listed below that run this website. Our use of information received from Google APIs follows the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    title: 'How we use your data',
    list: [
      'To create and secure your account, and verify your mobile number with a one-time SMS code.',
      'To verify your identity and eligibility to drive before you rent a car.',
      'To process bookings, deposits and payments, and manage your credit balance.',
      'To link your online account with a customer record our staff created at the counter, when the email address or SMS-verified mobile number matches.',
      'To contact you about your bookings, for example by WhatsApp, phone or email.',
      'To meet legal obligations, such as accounting records or requests from authorities about traffic offences involving our vehicles, and to prevent fraud.',
    ],
  },
  {
    title: 'Who we share it with',
    body: [
      'We do not sell your personal data. We share it only with service providers that run this website, under their own security and privacy terms: Supabase (database, login and file storage), Vercel (website hosting), Google (sign-in and website fonts) and our SMS provider (verification codes). If you message us on WhatsApp, WhatsApp’s terms apply to that conversation. We disclose data to authorities when Malaysian law requires it.',
    ],
  },
  {
    title: 'How we protect it',
    body: [
      'Your IC, licence and receipt images are kept in private storage. Only you and our authorised staff can open them, through links that expire. Access to customer records is limited to our staff accounts, and every connection to the site is encrypted (HTTPS).',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep your data while your account is active and afterwards for as long as the law requires, for example for tax and accounting records. When it is no longer needed, we delete it.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You may ask to see the personal data we hold about you, correct it, or withdraw your consent and ask us to delete your account. Some records may need to be kept to meet legal obligations. Contact us using the details below and we will respond within 21 days.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'If we change this policy we will update this page and the date at the top. Significant changes will be highlighted on the site.',
    ],
  },
];

export default function Privacy() {
  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
      </div>
      <p className="text-sm text-slate-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <div className="glass-card space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-white mb-3">{section.title}</h2>
            {section.body?.map((paragraph) => (
              <p key={paragraph} className="text-sm text-slate-300 leading-relaxed mb-3">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Contact us</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Bubat Resources (Rent2Go)
            <br />
            Email:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300">
              {CONTACT_EMAIL}
            </a>
            <br />
            Phone / WhatsApp: {CONTACT_PHONE}
          </p>
        </section>
      </div>

      <p className="text-center text-sm text-slate-500 mt-8">
        <Link to="/" className="text-violet-400 hover:text-violet-300">
          Back to Rent2Go
        </Link>
      </p>
    </div>
  );
}
