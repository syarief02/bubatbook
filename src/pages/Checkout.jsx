import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useCar } from '../hooks/useCars';
import { useAuth } from '../hooks/useAuth';
import { createHoldBooking, updateBookingCustomerInfo, simulatePayment, cancelBooking } from '../hooks/useBookings';
import BookingForm from '../components/BookingForm';
import PaymentSimulator from '../components/PaymentSimulator';
import LoadingSpinner from '../components/LoadingSpinner';
import { calculatePrice, formatMYR } from '../utils/pricing';
import { formatDate, formatTimeRemaining } from '../utils/dates';
import {
  ArrowLeft, Clock, CheckCircle, AlertTriangle, Shield,
  ChevronRight
} from 'lucide-react';

const STEPS = ['Your Info', 'Review', 'Payment'];

export default function Checkout() {
  const { carId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { car, loading: carLoading } = useCar(carId);

  const pickupDate = searchParams.get('pickup');
  const returnDate = searchParams.get('return');

  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [holdError, setHoldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const timerRef = useRef(null);

  // Create hold on mount
  useEffect(() => {
    if (!car || !user || !pickupDate || !returnDate || booking) return;
    async function createHold() {
      try {
        setLoading(true);
        const { days, total, deposit } = calculatePrice(car.price_per_day, pickupDate, returnDate);
        const hold = await createHoldBooking(car.id, user.id, pickupDate, returnDate, total, deposit);
        setBooking(hold);
      } catch (err) {
        setHoldError(err.message || 'Unable to hold this booking. The dates may no longer be available.');
      } finally {
        setLoading(false);
      }
    }
    createHold();
  }, [car, user, pickupDate, returnDate]);

  // Timer for hold expiry
  useEffect(() => {
    if (!booking?.hold_expires_at) return;
    function tick() {
      const remaining = formatTimeRemaining(booking.hold_expires_at);
      setTimeRemaining(remaining);
      if (remaining === 'Expired') {
        clearInterval(timerRef.current);
        // Auto-expire the hold in the database
        cancelBooking(booking.id).catch(() => {});
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [booking?.hold_expires_at, booking?.id]);

  if (carLoading || (loading && !holdError)) return <LoadingSpinner fullScreen />;

  if (!pickupDate || !returnDate || !car) {
    return (
      <div className="page-container text-center">
        <p className="text-red-400">Invalid checkout. Please select dates first.</p>
        <Link to="/" className="text-violet-400 hover:underline mt-4 inline-block">Back to fleet</Link>
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

  const { days, total, deposit } = calculatePrice(car.price_per_day, pickupDate, returnDate);
  const isExpired = timeRemaining === 'Expired';

  async function handleInfoSubmit(info) {
    try {
      setLoading(true);
      await updateBookingCustomerInfo(booking.id, info);
      setCustomerInfo(info);
      setStep(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentComplete() {
    try {
      await simulatePayment(booking.id, deposit);
      navigate(`/booking/${booking.id}/confirmation`);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page-container max-w-4xl mx-auto">
      <Link to={`/cars/${carId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to car
      </Link>

      {/* Hold Timer */}
      {booking && !isExpired && (
        <div className="glass-card !p-3 flex items-center justify-between mb-6 border-yellow-500/20">
          <div className="flex items-center gap-2 text-sm text-yellow-300">
            <Clock className="w-4 h-4" />
            <span>Booking held for you</span>
          </div>
          <span className="text-sm font-mono font-bold text-yellow-300">{timeRemaining}</span>
        </div>
      )}

      {isExpired && (
        <div className="glass-card !p-4 mb-6 border-red-500/20 text-center">
          <p className="text-red-400 font-medium">Your hold has expired. Please start over.</p>
          <Link to={`/cars/${carId}`} className="text-violet-400 hover:underline text-sm mt-2 inline-block">
            Go back
          </Link>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              i === step ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' :
              i < step ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-slate-500'
            }`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
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
                initialData={{ email: user?.email || '' }}
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
                  <button onClick={() => setStep(2)} className="btn-primary flex-1" disabled={isExpired}>
                    Proceed to Payment
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <PaymentSimulator
                depositAmount={deposit}
                onPaymentComplete={handlePaymentComplete}
                disabled={isExpired}
              />
            </div>
          )}
        </div>

        {/* Right: Booking Summary */}
        <div className="lg:w-80 shrink-0">
          <div className="glass-card lg:sticky lg:top-24">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Summary</h3>
            {car.image_url && (
              <img src={car.image_url} alt={car.name} className="w-full h-32 object-cover rounded-xl mb-4" />
            )}
            <h4 className="text-white font-semibold mb-1">{car.name}</h4>
            <p className="text-xs text-slate-500 mb-4">{car.brand} {car.model}</p>

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
                <span className="text-white">{days} day{days > 1 ? 's' : ''}</span>
              </div>
              <div className="border-t border-white/5 pt-3 flex justify-between">
                <span className="text-slate-400">Total</span>
                <span className="text-white font-semibold">{formatMYR(total)}</span>
              </div>
              <div className="flex justify-between bg-violet-500/10 rounded-xl px-3 py-2 -mx-1">
                <span className="text-violet-300 text-sm">Deposit</span>
                <span className="text-violet-300 font-bold">{formatMYR(deposit)}</span>
              </div>
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
