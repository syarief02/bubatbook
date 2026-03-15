import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatMYR } from '../utils/pricing';
import { formatDate } from '../utils/dates';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { Printer, ArrowLeft } from 'lucide-react';

export default function Invoice() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch booking with car info
        let query = supabase
          .from('bubatrent_booking_bookings')
          .select('*, bubatrent_booking_cars(*), bubatrent_booking_payments(*)')
          .eq('id', id);
        if (!isAdmin) query = query.eq('user_id', user.id);
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
  }, [id, user.id, isAdmin, navigate, toast]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (!booking) return null;

  const car = booking.bubatrent_booking_cars;
  const completedPayments = payments.filter((p) => p.status === 'completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const invoiceNumber = `INV-${booking.id.slice(0, 8).toUpperCase()}`;
  const companyName = fleet?.name || 'Bubat Resources';
  const hasVerifiedPayment =
    booking.deposit_status === 'verified' || booking.full_payment_status === 'verified';

  // Calculate days
  const pickupDate = new Date(booking.pickup_date);
  const returnDate = new Date(booking.return_date);
  const days = Math.max(1, Math.ceil((returnDate - pickupDate) / (1000 * 60 * 60 * 24)));

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
                  <td className="py-3 text-center text-gray-600">{days} hari</td>
                  <td className="py-3 text-right text-gray-600">
                    {formatMYR(car?.price_per_day || 0)}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatMYR(booking.total_price)}
                  </td>
                </tr>
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
            </div>
          </div>

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
