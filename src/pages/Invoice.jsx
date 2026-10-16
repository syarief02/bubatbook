import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatMYR } from '../utils/pricing';
import { formatDate } from '../utils/dates';
import { chargeLabel } from '../utils/charges';
import { workshopPayments } from '../utils/workshop';
import { RENTAL_CHANGES_SELECT, changeText, rentalChanges } from '../utils/rent';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { Printer, ArrowLeft } from 'lucide-react';

export default function Invoice() {
  const { id } = useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin && !user) {
      navigate('/login?returnTo=' + encodeURIComponent(`/booking/${id}/invoice`));
      return;
    }

    async function fetchData() {
      try {
        // Fetch booking with car info
        let query = supabase
          .from('bubatrent_booking_bookings')
          .select(
            '*, bubatrent_booking_cars(*), bubatrent_booking_payments(*), bubatrent_booking_charges(*), bubatrent_booking_workshop_payments(*), ' +
              RENTAL_CHANGES_SELECT
          )
          .eq('id', id);
        if (!isAdmin && user?.id) query = query.eq('user_id', user.id);
        const { data: bookingData, error: bErr } = await query.maybeSingle();
        if (bErr) throw bErr;
        if (!bookingData) {
          toast.error('Booking not found.');
          navigate(isAdmin ? '/admin/bookings' : '/my-bookings');
          return;
        }
        setBooking(bookingData);
        setPayments(bookingData.bubatrent_booking_payments || []);

        // Fetch fleet group for company details
        if (bookingData.fleet_group_id) {
          const { data: fleetData } = await supabase
            .from('bubatrent_booking_fleet_groups')
            .select('*')
            .eq('id', bookingData.fleet_group_id)
            .maybeSingle();
          setFleet(fleetData);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load invoice.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user, isAdmin, authLoading, navigate, toast]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (!booking) return null;

  const car = booking.bubatrent_booking_cars;
  const completedPayments = payments.filter((p) => p.status === 'completed');
  // Rental and deposit payments; payments for charges are listed with the charges
  const totalPaid = completedPayments
    .filter((p) => p.payment_type !== 'charge')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const charges = [...(booking.bubatrent_booking_charges || [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  const chargesFromDeposit = charges.reduce((s, c) => s + Number(c.from_deposit || 0), 0);
  const chargesPaid = completedPayments
    .filter((p) => p.payment_type === 'charge')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  // Repairs the customer paid the workshop for us, taken off what they owe
  const workshop = workshopPayments(booking);
  const workshopTotal = (key) => workshop.reduce((sum, w) => sum + Number(w[key] || 0), 0);
  // The rental as first booked, then each change (agreed price, extension,
  // early return, replacement car)
  const changes = rentalChanges(booking);
  const firstDateChange = changes.find((c) => ['extension', 'early_return'].includes(c.kind));
  const bookedReturn = firstDateChange?.old_return || booking.return_date;
  const bookedDays = Math.max(
    1,
    Math.round((Date.parse(bookedReturn) - Date.parse(booking.pickup_date)) / 86400000)
  );
  const bookedPrice =
    Number(booking.total_price) - changes.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const bookedBase = bookedPrice + Number(booking.long_rental_discount || 0);
  // Rent given back to the customer's credit when the price went down
  const rentPayments = completedPayments
    .filter((p) => p.payment_type === 'full_payment')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const rentRefunded = Math.max(
    rentPayments + workshopTotal('to_rent') - Number(booking.rent_paid || 0),
    0
  );
  const invoiceNumber = `INV-${booking.id.slice(0, 8).toUpperCase()}`;
  const companyName = fleet?.name || 'Bubat Resources';
  const hasVerifiedPayment =
    booking.deposit_status === 'verified' || booking.full_payment_status === 'verified';

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Action Bar (hidden when printing) */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>

        {/* Invoice Content */}
        <div className="bg-white text-gray-900 rounded-2xl shadow-xl p-8 sm:p-10 print:rounded-none print:shadow-none print:p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
              <p className="text-sm text-gray-500 mt-1">(201603369817) (PG0408963-K)</p>
              <p className="text-xs text-gray-400 mt-1">A5-3 Villaria Kondominium</p>
              <p className="text-xs text-gray-400">Jalan PJS 5/32, Taman Desaria</p>
              <p className="text-xs text-gray-400">46000 Petaling Jaya, Selangor</p>
              <p className="text-xs text-gray-400">Tel: {fleet?.support_phone || '016-256 9733'}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-3xl font-bold text-violet-600">INVOIS</p>
              <p className="text-sm text-gray-500 font-mono mt-1">{invoiceNumber}</p>
              <p className="text-xs text-gray-400 mt-2">
                Tarikh / Date: {new Date().toLocaleDateString('ms-MY')}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Bil Kepada / Bill To
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {booking.customer_name || 'Customer'}
              </p>
              <p className="text-xs text-gray-500">{booking.customer_email || ''}</p>
              <p className="text-xs text-gray-500">{booking.customer_phone || ''}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Butiran Sewaan / Rental Info
              </p>
              <p className="text-xs text-gray-500">
                Kenderaan:{' '}
                <span className="text-gray-800 font-medium">
                  {car?.brand} {car?.model}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                No. Pendaftaran:{' '}
                <span className="text-gray-800 font-medium">{car?.plate_number || '—'}</span>
              </p>
              <p className="text-xs text-gray-500">
                Tempoh:{' '}
                <span className="text-gray-800 font-medium">
                  {formatDate(booking.pickup_date)} → {formatDate(booking.return_date)}
                </span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 text-xs font-semibold text-gray-400 uppercase">
                    Keterangan / Description
                  </th>
                  <th className="text-center py-3 text-xs font-semibold text-gray-400 uppercase">
                    Kuantiti
                  </th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase">
                    Harga / Rate
                  </th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase">
                    Jumlah / Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">Sewa Kenderaan / Vehicle Rental</p>
                    <p className="text-xs text-gray-400">
                      {car?.brand} {car?.model} ({car?.plate_number})
                    </p>
                  </td>
                  <td className="py-3 text-center text-gray-600">{bookedDays} hari</td>
                  <td className="py-3 text-right text-gray-600">
                    {formatMYR(Math.round((bookedBase / bookedDays) * 100) / 100)}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatMYR(bookedBase)}
                  </td>
                </tr>
                {Number(booking.long_rental_discount) > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3" colSpan={3}>
                      <p className="font-medium text-gray-900">
                        Diskaun sewa panjang / Long-rental discount
                      </p>
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      -{formatMYR(booking.long_rental_discount)}
                    </td>
                  </tr>
                )}
                {changes.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-3" colSpan={3}>
                      <p className="font-medium text-gray-900">
                        {c.kind === 'car_change'
                          ? 'Kenderaan ganti / Replacement vehicle'
                          : 'Perubahan sewa / Rental change'}
                      </p>
                      <p className="text-xs text-gray-400">{changeText(c, { you: true })}</p>
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {Number(c.amount) === 0
                        ? '—'
                        : `${Number(c.amount) < 0 ? '-' : '+'}${formatMYR(Math.abs(Number(c.amount)))}`}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">
                      Deposit Keselamatan / Security Deposit
                    </p>
                    <p className="text-xs text-gray-400">
                      Dikembalikan jika tiada kerosakan / Refundable
                    </p>
                  </td>
                  <td className="py-3 text-center text-gray-600">1</td>
                  <td className="py-3 text-right text-gray-600">
                    {formatMYR(booking.deposit_amount)}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatMYR(booking.deposit_amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Jumlah Sewa / Subtotal</span>
                <span className="text-gray-900 font-medium">{formatMYR(booking.total_price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Deposit</span>
                <span className="text-gray-900 font-medium">
                  {formatMYR(booking.deposit_amount)}
                </span>
              </div>
              <div className="border-t-2 border-gray-200 pt-2 flex justify-between text-base">
                <span className="font-bold text-gray-900">JUMLAH / TOTAL</span>
                <span className="font-bold text-violet-600 text-lg">
                  {formatMYR(Number(booking.total_price) + Number(booking.deposit_amount))}
                </span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-green-600">Telah Dibayar / Paid</span>
                  <span className="text-green-600 font-medium">{formatMYR(totalPaid)}</span>
                </div>
              )}
              {rentRefunded > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Dikembalikan ke kredit / Back to your credit
                  </span>
                  <span className="text-gray-900 font-medium">-{formatMYR(rentRefunded)}</span>
                </div>
              )}
              {workshopTotal('to_rent') > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Dibayar kepada bengkel / Paid to workshop</span>
                  <span className="text-green-600 font-medium">
                    {formatMYR(workshopTotal('to_rent'))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Repairs the customer paid the workshop for, on our behalf */}
          {workshop.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Dibayar kepada Bengkel bagi Pihak Kami / Paid to the Workshop on Our Behalf
              </p>
              <table className="w-full text-sm mb-3">
                <tbody>
                  {workshop.map((w) => (
                    <tr key={w.id} className="border-b border-gray-100">
                      <td className="py-2">
                        <p className="font-medium text-gray-900">{w.workshop}</p>
                        <p className="text-xs text-gray-400">
                          {w.description} · {formatDate(w.paid_on)}
                        </p>
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {formatMYR(w.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-1 text-sm">
                  {workshopTotal('to_rent') > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ditolak daripada sewa / Off the rental</span>
                      <span className="text-gray-900">{formatMYR(workshopTotal('to_rent'))}</span>
                    </div>
                  )}
                  {workshopTotal('to_charges') > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ditolak daripada caj / Off charges</span>
                      <span className="text-gray-900">
                        {formatMYR(workshopTotal('to_charges'))}
                      </span>
                    </div>
                  )}
                  {workshopTotal('to_credit') > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ke baki kredit / To your credit</span>
                      <span className="text-gray-900">{formatMYR(workshopTotal('to_credit'))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Charges after the rental (late return, cleaning, fuel, damage) */}
          {charges.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Caj Selepas Sewaan / Charges After the Rental
              </p>
              <table className="w-full text-sm mb-3">
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2">
                        <p className="font-medium text-gray-900">{chargeLabel(c.kind)}</p>
                        {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {formatMYR(c.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ditolak daripada deposit / From deposit</span>
                    <span className="text-gray-900">{formatMYR(chargesFromDeposit)}</span>
                  </div>
                  {booking.deposit_credited_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deposit dikembalikan / Deposit returned</span>
                      <span className="text-gray-900">
                        {formatMYR(
                          Math.max(Number(booking.deposit_amount || 0) - chargesFromDeposit, 0)
                        )}
                      </span>
                    </div>
                  )}
                  {chargesPaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-600">Dibayar / Paid for charges</span>
                      <span className="text-green-600">{formatMYR(chargesPaid)}</span>
                    </div>
                  )}
                  {workshopTotal('to_charges') > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-600">
                        Dibayar kepada bengkel / Paid to workshop
                      </span>
                      <span className="text-green-600">
                        {formatMYR(workshopTotal('to_charges'))}
                      </span>
                    </div>
                  )}
                  {Number(booking.amount_owed) > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-red-600">Baki perlu dibayar / Balance due</span>
                      <span className="text-red-600">{formatMYR(booking.amount_owed)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Status Badge */}
          {hasVerifiedPayment && (
            <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200 mb-8">
              <p className="text-green-700 font-bold text-lg">
                ✓ BAYARAN DISAHKAN / PAYMENT VERIFIED
              </p>
              <p className="text-green-600 text-xs mt-1">
                Bayaran telah diterima dan disahkan oleh {companyName}.
              </p>
            </div>
          )}

          {!hasVerifiedPayment && (
            <div className="text-center p-4 rounded-xl bg-amber-50 border border-amber-200 mb-8">
              <p className="text-amber-700 font-bold">
                ⏳ MENUNGGU PENGESAHAN / PENDING VERIFICATION
              </p>
              <p className="text-amber-600 text-xs mt-1">
                Invois ini dijana secara automatik. Bayaran belum disahkan.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
            <p className="font-medium text-gray-500 mb-1">
              Terima kasih kerana memilih {companyName}!
            </p>
            <p>Invois ini dijana secara automatik oleh sistem Rent2Go.</p>
            <p>Untuk sebarang pertanyaan, sila hubungi {fleet?.support_phone || '016-256 9733'}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
