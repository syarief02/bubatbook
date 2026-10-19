import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMYR } from '../utils/pricing';
import { formatDate } from '../utils/dates';
import SignatureCanvas from './SignatureCanvas';
import { useToast } from './Toast';
import { FileText, AlertTriangle } from 'lucide-react';

// Damage liability table by engine CC (from Bubat Resources paper form)
const LIABILITY_TABLE = [
  { cc: '999cc dan ke bawah', workshop7: 'RM2,000', workshopMore: 'RM3,500', minor: 'RM600' },
  { cc: '1000cc - 1299cc', workshop7: 'RM3,000', workshopMore: 'RM4,000', minor: 'RM800' },
  { cc: '1300cc - 1499cc', workshop7: 'RM3,500', workshopMore: 'RM4,500', minor: 'RM1,000' },
  { cc: '1500cc - 1699cc', workshop7: 'RM5,000', workshopMore: 'RM5,000', minor: 'RM1,200' },
  { cc: '1700cc dan keatas', workshop7: 'RM6,000', workshopMore: 'RM6,000', minor: 'RM1,500' },
];

// The agreement's terms and the damage liability table, shown before and after signing
export function AgreementTerms() {
  return (
    <>
      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          TERMA & SYARAT (Terms & Conditions)
        </h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p className="text-xs text-slate-500 italic mb-4">
            Penyewa yang mengikat kontrak sewa kenderaan bulanan, jika berlaku kerosakan sewaktu
            tempoh sewa yang disebabkan oleh kenderaan itu sendiri, syarikat akan menggantikan
            kenderaan tersebut dengan yang lain. Jika ada, jika tiada kenderaan lain, syarikat akan
            beri sewa percuma mengikut hari yang terlibat.
          </p>

          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Penyewa bersetuju untuk menyewa dan memulangkan kenderaan pada{' '}
              <strong className="text-white">tarikh dan masa yang telah ditetapkan</strong>.
            </li>
            <li>
              Penyewa mestilah mempunyai{' '}
              <strong className="text-white">lesen memandu Malaysia Kelas D</strong> dan GDL Kelas D
              yang sah.
            </li>
            <li>
              Penyewa mestilah memaklumkan kepada syarikat sekiranya berlaku sebarang perkara yang
              tidak diingini. Contoh:{' '}
              <strong className="text-white">kemalangan, kehilangan dan sebagainya</strong>.
            </li>
            <li>
              Kenderaan mestilah digunakan untuk perkara yang{' '}
              <strong className="text-white">mematuhi undang-undang sahaja</strong>. Segala perkara
              yang melanggar undang-undang seperti pengedaran dadah, perlumbaan, perjudian dan
              sebagainya adalah <strong className="text-red-400">DILARANG</strong>.
            </li>
            <li>
              Penyewa adalah <strong className="text-white">bertanggungjawab</strong> dengan segala
              bentuk saman yang dikenakan, bayaran parking, minyak kenderaan, kerosakan atau
              kegagalan kenderaan yang berpunca dari penyewa sepanjang tempoh sewaan.
            </li>
            <li>
              Untuk sebarang <strong className="text-white">kelewatan pengembalian</strong>{' '}
              kenderaan, penyewa akan dikenakan caj sebanyak{' '}
              <strong className="text-yellow-400">RM10.00 / RM15.00 / RM20.00 sejam</strong>.
              Penyewa bertanggungjawab untuk memulangkan kenderaan dalam keadaan bersih. Jika tidak,
              deposit akan ditolak sebanyak <strong className="text-yellow-400">RM20</strong>.
            </li>
          </ol>
        </div>
      </div>

      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">INSURAN / PERSETUJUAN BERSAMA</h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <ol className="list-decimal pl-5 space-y-3">
            <li>
              Penyewa bersetuju untuk{' '}
              <strong className="text-white">bertanggungjawab sepenuhnya</strong> diatas segala
              kehilangan atau kerosakan pada kenderaan atau segala peralatan sepanjang tempoh sewaan
              mengikut terma dan syarat penyewaan kenderaan walaupun berpunca dari perlanggaraan,
              kebakaran, banjir, vandalisme, kecurian atau apapunpunca kecuali atas kerosakan atau
              kecacatan kenderaan itu sendiri.
            </li>
            <li>
              Penyewa <strong className="text-white">wajib membayar gantirugi</strong> kemalangan
              atau kerosakan kepada syarikat serta merta. Ganti rugi kemalangan yang dibayar oleh
              penyewa sama sekali tidak melibatkan tuntutan insuran kenderaan walaupun tuntutan
              insuran dibuat oleh syarikat.
            </li>
          </ol>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-white/10 p-2 text-left bg-white/5">CC Kenderaan</th>
                  <th className="border border-white/10 p-2 text-center bg-white/5">
                    Bengkel &lt; 7 Hari
                  </th>
                  <th className="border border-white/10 p-2 text-center bg-white/5">
                    Bengkel &gt; 7 Hari
                  </th>
                  <th className="border border-white/10 p-2 text-center bg-white/5">
                    Kerosakan Kecil
                  </th>
                </tr>
              </thead>
              <tbody>
                {LIABILITY_TABLE.map((row, i) => (
                  <tr key={i} className="text-white">
                    <td className="border border-white/10 p-2 text-slate-300">{row.cc}</td>
                    <td className="border border-white/10 p-2 text-center font-medium text-yellow-400">
                      {row.workshop7}
                    </td>
                    <td className="border border-white/10 p-2 text-center font-medium text-orange-400">
                      {row.workshopMore}
                    </td>
                    <td className="border border-white/10 p-2 text-center font-medium text-emerald-400">
                      {row.minor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ol className="list-decimal pl-5 space-y-2" start={3}>
            <li>
              Deposit akan <strong className="text-white">dikembalikan semula</strong> kepada
              penyewa diantara <strong className="text-white">7 hari bekerja</strong>. Sekiranya
              tidak berlaku sebarang perkara yang tidak diingini mengikut terma & syarat perjanjian
              penyewaan.
            </li>
            <li>
              Penalti sebanyak <strong className="text-yellow-400">25%</strong> dari jumlah bayaran
              keseluruhan tempoh sewaan akan dikenakan sekiranya penyewa{' '}
              <strong className="text-white">membatalkan atau memendekkan</strong> perjanjian tempoh
              sewaan.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}

// Renter and vehicle details, the terms and the signature pad. Used at checkout
// (before the deposit) and on the agreement page (later, or staff in person).
// renter: { name, ic, phone, email } as shown; the database copies the
// agreement's names, dates and prices from the booking when it is signed.
export default function RentalAgreementForm({ booking, car, renter, disabled = false, onSigned }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signatureData) {
      toast.error('Please draw your signature.');
      return;
    }
    if (!agreedToTerms) {
      toast.error('Please agree to the terms and conditions.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: agreement, error } = await supabase.rpc('bubatrent_sign_rental_agreement', {
        p_booking_id: booking.id,
        p_signature_data: signatureData,
      });

      if (error) throw error;

      toast.success('Agreement signed successfully!');
      onSigned(agreement);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to submit agreement.');
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
            <p className="text-white font-medium">{formatMYR(car?.price_per_day || 0)}/hari</p>
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
