import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AgreementTerms } from '../components/RentalAgreementForm';

const CONTACT_EMAIL = 'bubatresources@gmail.com';
const CONTACT_PHONE = '+60 19-496 1568';
const WHATSAPP = '60194961568';

// The rental terms, public so a customer can read them before signing up.
// Same text as the agreement every renter signs (AgreementTerms), so the two never differ.
export default function Terms() {
  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Terma & Syarat Sewaan</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">Rental Terms & Conditions · Rent2Go</p>

      <div className="glass-card mb-6 text-sm text-slate-300 leading-relaxed space-y-2">
        <p>
          Ini terma dalam perjanjian sewaan yang ditandatangani oleh setiap penyewa sebelum
          mengambil kenderaan. Sewa dan deposit untuk tarikh anda ditunjukkan semasa membuat
          tempahan. Saiz enjin (cc) setiap kenderaan ada di halaman kenderaan itu.
        </p>
        <p className="text-slate-400">
          These are the terms of the rental agreement every renter signs before pick-up. The rent
          and deposit for your dates are shown when you book. Each vehicle&apos;s engine size (cc)
          is on its car page.
        </p>
      </div>

      <AgreementTerms />

      <div className="glass-card text-sm text-slate-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-white mb-3">Pertanyaan / Questions</h2>
        <p>
          Bubat Resources (Rent2Go)
          <br />
          WhatsApp:{' '}
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300"
          >
            {CONTACT_PHONE}
          </a>
          <br />
          Email:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>

      <p className="text-center text-sm text-slate-500 mt-8">
        <Link to="/" className="text-violet-400 hover:text-violet-300">
          Lihat kenderaan / See the cars
        </Link>
        {' · '}
        <Link to="/privacy" className="text-violet-400 hover:text-violet-300">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
