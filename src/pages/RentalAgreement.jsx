import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatMYR } from '../utils/pricing';
import { formatDate, formatDateTime } from '../utils/dates';
import { RENTAL_CHANGES_SELECT, changeText, rentalChanges } from '../utils/rent';
import RentalAgreementForm, { AgreementTerms } from '../components/RentalAgreementForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { CheckCircle, Printer, UserCheck } from 'lucide-react';

// Walk-in customers created at the counter get a placeholder login email
const realEmail = (email) => (email && !email.endsWith('@bubatrent.local') ? email : '');

export default function RentalAgreement() {
  const { id } = useParams(); // booking id
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingAgreement, setExistingAgreement] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  // The customer whose agreement this is (staff open it to sign in person)
  const [renter, setRenter] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin && !user) {
      navigate('/login?returnTo=' + encodeURIComponent(`/booking/${id}/agreement`));
      return;
    }

    async function fetchBooking() {
      try {
        // Fetch booking with car info
        let query = supabase
          .from('bubatrent_booking_bookings')
          .select('*, bubatrent_booking_cars(*), ' + RENTAL_CHANGES_SELECT)
          .eq('id', id);

        // Non-admins can only view their own bookings
        if (!isAdmin && user?.id) {
          query = query.eq('user_id', user.id);
        }

        const { data: bookingData, error: bErr } = await query.maybeSingle();

        if (bErr) throw bErr;
        if (!bookingData) {
          toast.error('Booking not found or access denied.');
          navigate(isAdmin ? '/admin/bookings' : '/my-bookings');
          return;
        }
        setBooking(bookingData);
        const owner = Boolean(user?.id && bookingData.user_id === user.id);
        setIsOwner(owner);
        if (!owner && bookingData.user_id) {
          const { data: customer } = await supabase
            .from('bubatrent_booking_profiles')
            .select('display_name, ic_number, phone, email')
            .eq('id', bookingData.user_id)
            .maybeSingle();
          setRenter(customer);
        }

        // Check if already signed
        const { data: agreement } = await supabase
          .from('bubatrent_booking_rental_agreements')
          .select('*')
          .eq('booking_id', id)
          .maybeSingle();

        if (agreement) setExistingAgreement(agreement);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load booking.');
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, [id, user, isAdmin, authLoading, navigate, toast]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (!booking) return null;

  const car = booking.bubatrent_booking_cars;
  const renterInfo = isOwner ? profile : renter;
  const renterEmail = realEmail(isOwner ? user.email : renter?.email);
  const renterName =
    renterInfo?.display_name || booking.customer_name || renterEmail || 'the customer';

  if (existingAgreement) {
    return (
      <div className="min-h-screen py-8 px-4 print-plain">
        <div className="max-w-3xl mx-auto">
          {/* Action bar (hidden when printing) */}
          <div className="flex items-center justify-between mb-6 print:hidden">
            <button
              onClick={() => navigate(isOwner ? '/my-bookings' : `/admin/bookings/${id}`)}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← {isOwner ? 'My Bookings' : 'Booking'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
          </div>

          <div className="glass-card mb-6 text-center bg-green-500/5 border-green-500/20">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-white mb-1">PERJANJIAN SEWAAN KENDERAAN</h1>
            <p className="text-green-400 text-sm font-medium">✓ Ditandatangani / Signed</p>
            <p className="text-slate-500 text-xs mt-1">
              Signed on {formatDateTime(existingAgreement.agreed_at)}
            </p>
            {existingAgreement.signed_in_person_by && (
              <p className="text-slate-500 text-xs mt-0.5">
                Ditandatangani di kaunter / Signed in person at the counter
              </p>
            )}
          </div>

          <div className="glass-card mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">BUTIRAN PENYEWA & KENDERAAN</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Nama / Name</p>
                <p className="text-white font-medium">{existingAgreement.customer_name}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">No. K/P / IC</p>
                <p className="text-white font-medium">{existingAgreement.customer_ic || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Kenderaan / Vehicle</p>
                <p className="text-white font-medium">{existingAgreement.car_model}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">No. Pendaftaran / Plate</p>
                <p className="text-white font-medium">{existingAgreement.car_plate || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Tarikh Mula / Pickup</p>
                <p className="text-white font-medium">
                  {formatDate(existingAgreement.pickup_date)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Tarikh Tamat / Return</p>
                <p className="text-white font-medium">
                  {formatDate(existingAgreement.return_date)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Jumlah Sewa / Total</p>
                <p className="text-white font-medium">{formatMYR(existingAgreement.total_price)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Deposit</p>
                <p className="text-white font-medium">
                  {formatMYR(existingAgreement.deposit_amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Extensions, early return, replacement car agreed after signing */}
          {booking &&
            rentalChanges(booking).filter((c) => c.created_at > existingAgreement.agreed_at)
              .length > 0 && (
              <div className="glass-card mb-6">
                <h2 className="text-lg font-semibold text-white mb-1">
                  PERUBAHAN SELEPAS DITANDATANGANI
                </h2>
                <p className="text-xs text-slate-500 mb-3">Changes after signing</p>
                <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
                  {rentalChanges(booking)
                    .filter((c) => c.created_at > existingAgreement.agreed_at)
                    .map((c) => (
                      <li key={c.id}>
                        {formatDate(c.created_at)}: {changeText(c, { you: true })}
                        {Number(c.amount) !== 0 &&
                          ` (${Number(c.amount) > 0 ? '+' : '−'}${formatMYR(Math.abs(Number(c.amount)))})`}
                      </li>
                    ))}
                </ul>
                <p className="text-xs text-slate-500 mt-3">
                  Return date now {formatDate(booking.return_date)}, rental now{' '}
                  {formatMYR(booking.total_price)}. The terms above still apply.
                </p>
              </div>
            )}

          <AgreementTerms />

          <div className="glass-card mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              TANDATANGAN PENYEWA (Customer Signature)
            </h2>
            <div className="bg-white rounded-xl p-4 max-w-xs">
              <img
                src={existingAgreement.signature_data}
                alt="Customer Signature"
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Ditandatangani pada / Signed on: {formatDateTime(existingAgreement.agreed_at)}
              {existingAgreement.signed_in_person_by && ' (di kaunter / in person)'}
            </p>
          </div>

          <button
            onClick={() => navigate(isOwner ? '/my-bookings' : `/admin/bookings/${id}`)}
            className="btn-primary w-full print:hidden"
          >
            {isOwner ? 'Back to My Bookings' : 'Back to Booking'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="glass-card mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">PERJANJIAN SEWAAN KENDERAAN</h1>
          <p className="text-slate-400 text-sm">Rental Agreement / Surat Perjanjian Sewa Kereta</p>
        </div>

        {!isOwner && (
          <div className="glass-card mb-6 flex items-start gap-3 border-amber-500/20 bg-amber-500/5">
            <UserCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-medium">Signing in person (staff)</p>
              <p className="text-slate-400 mt-1">
                Hand this screen to <strong className="text-white">{renterName}</strong> to read the
                agreement, sign and tick the box. It is saved as their agreement, signed in person
                on your device. Check their IC first.
              </p>
            </div>
          </div>
        )}

        <RentalAgreementForm
          booking={booking}
          car={car}
          renter={{
            name: renterName,
            ic: renterInfo?.ic_number,
            phone: renterInfo?.phone || booking.customer_phone,
            email: renterEmail,
          }}
          onSigned={setExistingAgreement}
        />

        <p className="text-center text-xs text-slate-600 mt-6 mb-8">
          Terima kasih dan selamat memandu. · Thank you and drive safely.
        </p>
      </div>
    </div>
  );
}
