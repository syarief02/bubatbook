import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AgreementTerms } from '../components/AgreementTerms';
import { BOCAH_NAME, BOCAH_SSM, BUBAT_NAME, BUBAT_SSM } from '../data/company';

const CONTACT_EMAIL = 'bubatresources@gmail.com';
const CONTACT_PHONE = '+60 19-496 1568';
const WHATSAPP = '60194961568';

// The rental terms, public so a customer can read them before signing up.
// Same text as the agreement every renter signs (AgreementTerms), so the two never differ.
export default function Terms() {
  return (
    <div className="page-container max-w-3xl mx-auto">
      {/* Also the file name of Print / Save PDF */}
      <title>Rent2Go Terms and Conditions</title>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Terma & Syarat Sewaan</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">Rental Terms & Conditions · Rent2Go</p>

      <div className="text-sm leading-relaxed space-y-2 mb-6 pl-4 border-l-2 border-violet-500/40">
        <p className="text-slate-300">
          Terma perjanjian yang ditandatangani <b className="text-white">setiap penyewa</b> sebelum
          mengambil kenderaan, sama bagi semua kenderaan di Rent2Go. Saiz enjin (cc) ada di halaman
          setiap kenderaan. Perjanjian yang sudah ditandatangani kekal dengan terma asalnya (lihat
          My Bookings).
        </p>
        <p className="text-slate-500">
          The agreement every renter signs before pick-up, the same for every vehicle on Rent2Go.
          Each vehicle&apos;s engine size (cc) is on its car page. A signed agreement keeps the
          terms it was signed with (see My Bookings).
        </p>
      </div>

      <AgreementTerms />

      <div className="glass-card text-sm text-slate-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-white mb-3">Pertanyaan / Questions</h2>
        <p>
          {BUBAT_NAME} (Rent2Go) · No. SSM {BUBAT_SSM}
          <br />
          {BOCAH_NAME} · No. SSM {BOCAH_SSM}
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
          Dasar Privasi / Privacy Policy
        </Link>
      </p>
    </div>
  );
}
