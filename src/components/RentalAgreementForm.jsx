import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMYR } from '../utils/pricing';
import { formatDate, getDaysDifference } from '../utils/dates';
import SignatureCanvas from './SignatureCanvas';
import { useToast } from './Toast';
import { FileText, AlertTriangle } from 'lucide-react';
import { AgreementTerms } from './AgreementTerms';
import { useTranslation } from 'react-i18next';

// Renter and vehicle details, the terms and the signature pad. Used at checkout
// (before the deposit) and on the agreement page (later, or staff in person).
// renter: { name, ic, phone, email } as shown; the database copies the
// agreement's names, dates and prices from the booking when it is signed.
export default function RentalAgreementForm({ booking, car, renter, disabled = false, onSigned }) {
  const toast = useToast();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // The rate the customer actually pays: the booking's rent over its days, so
  // an agreed price, a package or a long-rental discount shows as charged
  const rentalDays = Math.max(1, getDaysDifference(booking.pickup_date, booking.return_date));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signatureData) {
      toast.error(t('Please draw your signature.'));
      return;
    }
    if (!agreedToTerms) {
      toast.error(t('Please agree to the terms and conditions.'));
      return;
    }

    setSubmitting(true);
    try {
      const { data: agreement, error } = await supabase.rpc('bubatrent_sign_rental_agreement', {
        p_booking_id: booking.id,
        p_signature_data: signatureData,
      });

      if (error) throw error;

      toast.success(t('Agreement signed successfully!'));
      onSigned(agreement);
    } catch (err) {
      console.error(err);
      toast.error(err.message || t('Failed to submit agreement.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-violet-400" />
          BUTIRAN PENYEWA (Renter Details)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Nama / Name</p>
            <p className="text-white font-medium">{renter.name}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">No. K/P / IC Number</p>
            <p className="text-white font-medium">{renter.ic || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">No. Telefon / Phone</p>
            <p className="text-white font-medium">{renter.phone || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Email</p>
            <p className="text-white font-medium">{renter.email || '—'}</p>
          </div>
        </div>
      </div>

      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          BUTIRAN KENDERAAN (Vehicle Details)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Model Kenderaan / Vehicle</p>
            <p className="text-white font-medium">
              {car?.brand} {car?.model}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">No. Pendaftaran / Plate</p>
            <p className="text-white font-medium">{car?.plate_number || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Tarikh Mula / Pickup Date</p>
            <p className="text-white font-medium">{formatDate(booking.pickup_date)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Tarikh Tamat / Return Date</p>
            <p className="text-white font-medium">{formatDate(booking.return_date)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Kadar Sewa / Daily Rate</p>
            <p className="text-white font-medium">
              {formatMYR(rentalDays > 0 ? Number(booking.total_price || 0) / rentalDays : 0)}/hari ×{' '}
              {rentalDays} hari
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Jumlah Sewa / Total</p>
            <p className="text-white font-medium text-lg">{formatMYR(booking.total_price)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Deposit</p>
            <p className="text-white font-medium">{formatMYR(booking.deposit_amount)}</p>
          </div>
        </div>
      </div>

      <AgreementTerms />

      <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">
          Dengan menandatangani perjanjian ini, anda bersetuju untuk mematuhi semua terma dan syarat
          yang dinyatakan di atas. Pelanggaran mana-mana syarat boleh menyebabkan tindakan
          undang-undang.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="glass-card mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            TANDATANGAN PENYEWA (Customer Signature)
          </h2>
          <SignatureCanvas onSignatureChange={setSignatureData} />
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500 cursor-pointer"
          />
          <span className="text-sm text-slate-300">
            Saya telah membaca dan <strong className="text-white">bersetuju</strong> dengan semua
            terma dan syarat perjanjian sewaan kenderaan di atas. / I have read and agree to all
            terms and conditions stated above.
          </span>
        </label>

        <button
          type="submit"
          disabled={disabled || submitting || !signatureData || !agreedToTerms}
          className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
        >
          {submitting ? 'Menghantar...' : '✍️ Tandatangan & Setuju (Sign & Agree)'}
        </button>
      </form>
    </>
  );
}
