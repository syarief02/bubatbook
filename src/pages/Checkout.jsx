import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useCar } from '../hooks/useCars';
import { useAuth } from '../hooks/useAuth';
import {
  createHoldBooking,
  updateBookingCustomerInfo,
  cancelBooking,
  submitBookingDeposit,
} from '../hooks/useBookings';
import { uploadFileRobust } from '../lib/uploadHelper';
import { supabase } from '../lib/supabase';
import BookingForm from '../components/BookingForm';
import RentalAgreementForm from '../components/RentalAgreementForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { calculatePrice, formatMYR, longRentalLabel } from '../utils/pricing';
import { formatDate, formatDateTime, formatTimeRemaining } from '../utils/dates';
import { hasBankDetails } from '../utils/banks';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  ChevronRight,
  FileCheck,
  Upload,
  FileImage,
  Loader2,
  Wallet,
  MessageCircle,
  Landmark,
} from 'lucide-react';
import { useToast } from '../components/Toast';

// The customer signs the rental agreement before paying the deposit
const STEPS = ['Your Info', 'Review', 'Agreement', 'Payment'];

export default function Checkout() {
  const { carId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, isVerified, refreshProfile } = useAuth();
  const toast = useToast();
  const { car, loading: carLoading } = useCar(carId);

  const pickupDate = searchParams.get('pickup');
  const returnDate = searchParams.get('return');

  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [holdError, setHoldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef(null);
  const holdCreatedRef = useRef(false);

  // 6-month advance booking limit
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  const isTooFarAdvance = returnDate && new Date(returnDate) > sixMonthsFromNow;

  // Deposit credit
  const credit = Number(profile?.deposit_credit || 0);

  // Online bookings need the bank account deposits are refunded to
  const needsBank = isVerified && !hasBankDetails(profile);

  // Create hold on mount
  useEffect(() => {
    if (!car || !user || !pickupDate || !returnDate || booking || holdCreatedRef.current) return;
    if (isTooFarAdvance || needsBank) return;
    holdCreatedRef.current = true;
    async function createHold() {
      try {
        setLoading(true);
        const hold = await createHoldBooking(car.id, pickupDate, returnDate);
        // Back for a car they already hold: carry on where they left off
        if (hold.customer_name) {
          setCustomerInfo({
            name: hold.customer_name,
            email: hold.customer_email,
            phone: hold.customer_phone,
            notes: hold.notes || '',
          });
          const { data: signed } = await supabase
            .from('bubatrent_booking_rental_agreements')
            .select('id')
            .eq('booking_id', hold.id)
            .maybeSingle();
          setStep(signed ? 3 : 1);
        }
        setBooking(hold);
      } catch (err) {
        holdCreatedRef.current = false;
        setHoldError(
          err.message || 'Unable to hold this booking. The dates may no longer be available.'
        );
      } finally {
        setLoading(false);
      }
    }
    createHold();
    // booking and holdCreatedRef guard against duplicate holds; isTooFarAdvance derives from returnDate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car, user, pickupDate, returnDate, needsBank]);

  // Timer for hold expiry
  useEffect(() => {
    if (!booking?.hold_expires_at) return;
    function tick() {
      const remaining = formatTimeRemaining(booking.hold_expires_at);
      setTimeRemaining(remaining);
      if (remaining === 'Expired') {
        clearInterval(timerRef.current);
        cancelBooking(booking.id).catch(() => {});
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [booking?.hold_expires_at, booking?.id]);

  // Each step starts at the top (the agreement is long)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  if (carLoading || (loading && !holdError)) return <LoadingSpinner fullScreen />;

  if (!pickupDate || !returnDate || !car) {
    return (
      <div className="page-container text-center">
        <p className="text-red-400">Invalid checkout. Please select dates first.</p>
        <Link to="/" className="text-violet-400 hover:underline mt-4 inline-block">
          Back to fleet
        </Link>
      </div>
    );
  }

  // Block unverified users
  if (!isVerified) {
    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="glass-card">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Verification Required</h2>
          <p className="text-sm text-slate-400 mb-6">
            You need to verify your identity before booking a car.
          </p>
          <Link to="/verify" className="btn-primary inline-flex items-center gap-2">
            Verify Now
          </Link>
        </div>
      </div>
    );
  }

  // Verified before bank details were asked for: add them once, then come back
  if (needsBank) {
    const back = `/checkout/${carId}?pickup=${pickupDate}&return=${returnDate}`;
    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="glass-card">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Landmark className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Add Your Bank Details</h2>
          <p className="text-sm text-slate-400 mb-6">
            Before you book, add the bank account we refund your deposit to. You only need to do
            this once, and you come back to this booking after saving.
          </p>
          <Link
            to={`/profile?returnTo=${encodeURIComponent(back)}#bank`}
            className="btn-primary inline-flex items-center gap-2"
          >
            Add Bank Details
          </Link>
        </div>
      </div>
    );
  }

  // Block too-far-advance bookings
  if (isTooFarAdvance) {
    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="glass-card">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Booking Too Far in Advance</h2>
          <p className="text-sm text-slate-400 mb-6">
            You can only book up to 6 months in advance.
          </p>
          <Link to={`/cars/${carId}`} className="btn-primary inline-flex items-center gap-2">
            Change Dates
          </Link>
        </div>
      </div>
    );
  }

  if (holdError) {
    return (
      <div className="page-container max-w-lg mx-auto text-center">
        <div className="glass-card">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Booking Unavailable</h2>
          <p className="text-sm text-slate-400 mb-6">{holdError}</p>
          <Link to={`/cars/${carId}`} className="btn-primary inline-flex items-center gap-2">
            Try Different Dates
          </Link>
        </div>
      </div>
    );
  }

  const estimate = calculatePrice(car.price_per_day, pickupDate, returnDate, car.long_rental_rates);
  const days = estimate.days;
  const total = booking ? Number(booking.total_price) : estimate.total;
  const deposit = booking ? Number(booking.deposit_amount) : estimate.deposit;
  const creditApplied = Math.min(credit, deposit);
  const amountDue = deposit - creditApplied;
  const isExpired = timeRemaining === 'Expired';

  async function handleInfoSubmit(info) {
    try {
      setLoading(true);
      await updateBookingCustomerInfo(booking.id, info);
      setCustomerInfo(info);
      setStep(1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAgreementSigned() {
    setStep(3);
    // Signing leaves at least 10 minutes to pay: show the time left
    const { data } = await supabase
      .from('bubatrent_booking_bookings')
      .select('hold_expires_at')
      .eq('id', booking.id)
      .maybeSingle();
    if (data?.hold_expires_at) setBooking((b) => ({ ...b, hold_expires_at: data.hold_expires_at }));
  }

  async function handleDepositPayment() {
    if (amountDue > 0 && !receiptFile) {
      toast.error('Please upload your payment receipt.');
      return;
    }

    setUploading(true);
    try {
      let receiptPath = null;

      if (receiptFile) {
        const ext =
          receiptFile.name
            .split('.')
            .pop()
            .replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const path = `receipts/${booking.id}/deposit_${Date.now()}.${ext}`;
        const { error: upErr } = await uploadFileRobust(
          'customer-documents',
          path,
          receiptFile,
          toast
        );
        if (upErr) throw upErr;
        receiptPath = path;
      }

      // Marks the deposit paid, records the payment and applies credit in one step
      const updated = await submitBookingDeposit(booking.id, receiptPath);
      if (Number(updated?.credit_applied) > 0) await refreshProfile();

      navigate(`/booking/${booking.id}/confirmation`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page-container max-w-4xl mx-auto">
      <Link
        to={`/cars/${carId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to car
      </Link>

      {/* Hold Timer */}
      {booking && !isExpired && (
        <div className="glass-card !p-3 flex items-center justify-between mb-6 border-yellow-500/20">
          <div className="flex items-center gap-2 text-sm text-yellow-300">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Held for you until {formatDateTime(booking.hold_expires_at)}</span>
          </div>
          <span className="text-sm font-mono font-bold text-yellow-300">{timeRemaining}</span>
        </div>
      )}

      {isExpired && (
        <div className="glass-card !p-4 mb-6 border-red-500/20 text-center">
          <p className="text-red-400 font-medium">Your hold has expired. Please start over.</p>
          <Link
            to={`/cars/${carId}`}
            className="text-violet-400 hover:underline text-sm mt-2 inline-block"
          >
            Go back
          </Link>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === step
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : i < step
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-white/5 text-slate-500'
              }`}
            >
              {i < step ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 text-center">{i + 1}</span>
              )}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-700" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Current Step */}
        <div className="flex-1 min-w-0">
          {step === 0 && (
            <div className="glass-card animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-6">Your Information</h2>
              <BookingForm
                onSubmit={handleInfoSubmit}
                loading={loading}
                initialData={
                  customerInfo || {
                    email: user?.email || '',
                    name: profile?.display_name || '',
                    phone: profile?.phone || '',
                  }
                }
              />
            </div>
          )}

          {step === 1 && (
            <div className="glass-card animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-6">Review Your Booking</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Name</p>
                    <p className="text-sm text-white">{customerInfo?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Email</p>
                    <p className="text-sm text-white">{customerInfo?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Phone</p>
                    <p className="text-sm text-white">{customerInfo?.phone}</p>
                  </div>
                </div>
                {customerInfo?.notes && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Notes</p>
                    <p className="text-sm text-slate-300">{customerInfo.notes}</p>
                  </div>
                )}
                <div className="border-t border-white/5 pt-4 flex gap-3">
                  <button onClick={() => setStep(0)} className="btn-secondary flex-1">
                    Edit Info
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="btn-primary flex-1"
                    disabled={isExpired}
                  >
                    Continue to Agreement
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <div className="glass-card mb-6">
                <h2 className="text-lg font-semibold text-white mb-2">Rental Agreement</h2>
                <p className="text-sm text-slate-400">
                  Perjanjian Sewaan Kenderaan. Read and sign the agreement before paying the
                  deposit.
                </p>
              </div>
              <RentalAgreementForm
                booking={booking}
                car={car}
                renter={{
                  name: profile?.display_name || customerInfo?.name || user?.email,
                  ic: profile?.ic_number,
                  phone: profile?.phone || customerInfo?.phone,
                  email: user?.email,
                }}
                disabled={isExpired}
                onSigned={handleAgreementSigned}
              />
              <button onClick={() => setStep(1)} className="btn-secondary w-full mt-3">
                Back to Review
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="glass-card animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-2">Deposit Payment</h2>
              <p className="text-sm text-slate-400 mb-6">
                Upload your payment receipt to secure this booking. Full rental payment is due at
                pickup.
              </p>

              {/* Credit applied */}
              {creditApplied > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 mb-4">
                  <Wallet className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-sm text-green-300 font-medium">
                      Credit Applied: {formatMYR(creditApplied)}
                    </p>
                    <p className="text-xs text-green-400/70">Deducted from your deposit balance</p>
                  </div>
                </div>
              )}

              {/* Payment breakdown */}
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Deposit Required</span>
                  <span className="text-white">{formatMYR(deposit)}</span>
                </div>
                {creditApplied > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Credit Applied</span>
                    <span>-{formatMYR(creditApplied)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/5 pt-2 font-semibold">
                  <span className="text-white">Amount Due</span>
                  <span className="text-violet-300">{formatMYR(amountDue)}</span>
                </div>
              </div>

              {/* Receipt upload (if payment needed) */}
              {amountDue > 0 ? (
                (() => {
                  const contactPhone =
                    car?.bubatrent_booking_fleet_groups?.support_whatsapp?.replace(/\D/g, '') ||
                    '60194961568';
                  const contactName =
                    car?.bubatrent_booking_fleet_groups?.name || 'Rent2Go Support';
                  const whatsappUrl = `https://wa.me/${contactPhone}?text=${encodeURIComponent(`Hi ${contactName}, I would like to pay the deposit of ${formatMYR(amountDue)} for booking ${car?.brand} ${car?.model}. Please provide the bank account details.`)}`;

                  return (
                    <>
                      <div className="text-xs text-slate-400 mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="block mb-2 text-white font-medium">
                          Payment Instructions:
                        </span>
                        <ol className="list-decimal pl-4 space-y-1.5">
                          <li>
                            Please{' '}
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-400 hover:text-green-300 hover:underline font-medium"
                            >
                              WhatsApp our admin
                            </a>{' '}
                            to get the bank account details.
                          </li>
                          <li>
                            Transfer{' '}
                            <span className="text-white font-semibold">{formatMYR(amountDue)}</span>{' '}
                            to the provided account.
                          </li>
                          <li>Upload your payment receipt below to secure your booking.</li>
                        </ol>
                      </div>

                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3.5 mb-6 bg-[#25D366] hover:bg-[#20BE5C] text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-[#25D366]/30 hover:-translate-y-0.5"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>WhatsApp Admin for Bank Details</span>
                      </a>
                      <p className="text-xs text-slate-500 -mt-3 mb-6">
                        Waiting for a reply? You can leave this page: the car stays held for you
                        until {formatDateTime(booking.hold_expires_at)}. Come back from{' '}
                        <Link to="/my-bookings" className="text-violet-400 hover:underline">
                          My Bookings
                        </Link>{' '}
                        to upload the receipt.
                      </p>

                      <label className="relative flex items-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors mb-6 overflow-hidden">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setReceiptFile(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          disabled={uploading}
                        />
                        <FileImage className="w-6 h-6 text-slate-500" />
                        <div>
                          <p className="text-sm text-slate-300">
                            {receiptFile
                              ? receiptFile.name
                              : 'Click or tap to upload payment receipt'}
                          </p>
                          <p className="text-xs text-slate-500">
                            JPG, PNG, WebP or PDF · Up to 12MB
                          </p>
                        </div>
                      </label>
                    </>
                  );
                })()
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 mb-6">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-300">
                    Deposit fully covered by your credit balance!
                  </p>
                </div>
              )}

              <button
                onClick={handleDepositPayment}
                disabled={uploading || isExpired || (amountDue > 0 && !receiptFile)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />{' '}
                    {amountDue > 0 ? 'Submit Deposit Payment' : 'Confirm Booking'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right: Booking Summary */}
        <div className="lg:w-80 shrink-0">
          <div className="glass-card lg:sticky lg:top-24">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Summary
            </h3>
            {car.image_url && (
              <img
                src={car.image_url}
                alt={car.name}
                className="w-full h-32 object-cover rounded-xl mb-4"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <h4 className="text-white font-semibold mb-1">{car.name}</h4>
            <p className="text-xs text-slate-500 mb-4">
              {car.brand} {car.model}
            </p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Pick-up</span>
                <span className="text-white">{formatDate(pickupDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Return</span>
                <span className="text-white">{formatDate(returnDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration</span>
                <span className="text-white">
                  {days} day{days > 1 ? 's' : ''}
                </span>
              </div>
              {(booking ? Number(booking.long_rental_discount) : estimate.longDiscount) > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>{longRentalLabel(days, estimate.discountPct)}</span>
                  <span>
                    -
                    {formatMYR(
                      booking ? Number(booking.long_rental_discount) : estimate.longDiscount
                    )}
                  </span>
                </div>
              )}
              <div className="border-t border-white/5 pt-3 flex justify-between">
                <span className="text-slate-400">Rental Total</span>
                <span className="text-white font-semibold">{formatMYR(total)}</span>
              </div>
              <div className="flex justify-between bg-violet-500/10 rounded-xl px-3 py-2 -mx-1">
                <span className="text-violet-300 text-sm">Deposit (Security)</span>
                <span className="text-violet-300 font-bold">{formatMYR(deposit)}</span>
              </div>
              <p className="text-xs text-slate-600 italic">
                Full rental payment ({formatMYR(total)}) due at pickup
              </p>
            </div>

            <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-600">
              <Shield className="w-3.5 h-3.5" />
              <span>Secure checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
