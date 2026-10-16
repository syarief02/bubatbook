import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { uploadFileRobust } from '../../lib/uploadHelper';
import { friendlyDbError } from '../../utils/dbErrors';
import { ilikeAny } from '../../utils/search';
import { calculatePrice, formatMYR, longRentalLabel } from '../../utils/pricing';
import { useLongRentalRates } from '../../hooks/useCars';
import { getTodayString } from '../../utils/dates';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  ArrowLeft,
  Search,
  Check,
  Shield,
  Loader2,
  User,
  FileImage,
  AlertTriangle,
} from 'lucide-react';

// Why a customer can't be booked yet (the database checks the same), or null
function bookingBlock(c) {
  if (!c) return null;
  if (!c.is_verified) return 'Not verified';
  if (c.licence_expiry && c.licence_expiry < getTodayString()) return 'Licence expired';
  return null;
}

export default function AdminBookForCustomer() {
  const { activeFleetId, activeFleet } = useFleet();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1); // 1=customer, 2=car, 3=dates, 4=confirm

  // Step 1: Customer
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [selectedCust, setSelectedCust] = useState(null);
  const [searching, setSearching] = useState(false);

  // Step 2: Car
  const [cars, setCars] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [carsLoading, setCarsLoading] = useState(false);

  // Step 3: Dates
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [existingBookings, setExistingBookings] = useState([]);

  // Step 4: Config
  const [depositInput, setDepositInput] = useState(100);
  const [depositTouched, setDepositTouched] = useState(false);
  const [initialStatus, setInitialStatus] = useState('CONFIRMED');
  const [depositReceipt, setDepositReceipt] = useState(null);
  const [useCredit, setUseCredit] = useState(true);
  const [notes, setNotes] = useState('');
  const [agreedPrice, setAgreedPrice] = useState(''); // '' = the normal price
  const [priceNote, setPriceNote] = useState('');
  const [creating, setCreating] = useState(false);

  // Search customers
  async function handleCustSearch(q) {
    setCustSearch(q);
    if (q.length < 2) {
      setCustResults([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase
      .from('bubatrent_booking_profiles')
      .select(
        'id, display_name, username, email, phone, ic_number, is_verified, licence_expiry, deposit_credit'
      )
      .or(ilikeAny(['display_name', 'phone', 'ic_number', 'username'], q))
      .limit(10);
    if (error) console.error('[BookForCustomer] Search error:', error);
    setCustResults(data || []);
    setSearching(false);
  }

  const BLOCKING_STATUSES = ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP'];

  // Fetch cars when step 2
  useEffect(() => {
    if (step === 2 && activeFleetId) {
      setCarsLoading(true);
      supabase
        .from('bubatrent_booking_cars')
        .select('*')
        .eq('fleet_group_id', activeFleetId)
        .eq('is_available', true)
        .order('name')
        .then(({ data }) => {
          setCars(data || []);
          setCarsLoading(false);
        });
    }
  }, [step, activeFleetId]);

  // Fetch existing bookings for selected car when entering Step 3
  useEffect(() => {
    if (step === 3 && selectedCar) {
      supabase
        .from('bubatrent_booking_bookings')
        .select('id, pickup_date, return_date, status, customer_name')
        .eq('car_id', selectedCar.id)
        .in('status', ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP', 'HOLD'])
        .gte('return_date', new Date().toISOString().split('T')[0])
        .order('pickup_date')
        .then(({ data }) => {
          setExistingBookings(data || []);
        });
    }
  }, [step, selectedCar]);

  // Check if selected dates overlap with confirmed bookings
  function getOverlap() {
    if (!pickupDate || !returnDate) return null;
    return existingBookings.find(
      (b) =>
        BLOCKING_STATUSES.includes(b.status) &&
        b.pickup_date <= returnDate &&
        b.return_date >= pickupDate
    );
  }

  // Validate dates
  function validateDates() {
    if (!pickupDate || !returnDate) {
      setDateError('Dates are required');
      return false;
    }
    const pickup = new Date(pickupDate);
    const ret = new Date(returnDate);
    if (ret <= pickup) {
      setDateError('Return must be after pickup');
      return false;
    }
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    if (pickup > sixMonths) {
      setDateError('Pickup must be within 6 months');
      return false;
    }
    const overlap = getOverlap();
    if (overlap) {
      setDateError(
        `Dates overlap with a ${overlap.status} booking (${overlap.pickup_date} → ${overlap.return_date})`
      );
      return false;
    }
    setDateError('');
    return true;
  }

  // Same price and deposit rule as an online booking (the server computes the
  // price), unless staff enter a price agreed with the customer
  const rates = useLongRentalRates(selectedCar?.fleet_group_id);
  const estimate = selectedCar
    ? calculatePrice(selectedCar.price_per_day || 0, pickupDate, returnDate, rates)
    : calculatePrice(0, null, null);
  const agreed = agreedPrice !== '' && Number(agreedPrice) !== estimate.total;
  function calcTotal() {
    return agreed ? Math.round(Number(agreedPrice) * 100) / 100 : estimate.total;
  }
  const depositRule = estimate.days > 0 ? Math.max(100, Math.ceil(calcTotal() * 0.3)) : 100;

  // The deposit follows the online rule for the chosen dates until staff change it
  const depositAmount = depositTouched ? depositInput : depositRule;

  const credit = Math.max(0, Number(selectedCust?.deposit_credit || 0));
  const creditApplied = useCredit ? Math.min(credit, Number(depositAmount) || 0) : 0;
  const toCollect = Math.max(0, (Number(depositAmount) || 0) - creditApplied);

  async function handleCreate() {
    if (!validateDates()) return;
    if (depositAmount < 100) {
      toast.error('Minimum deposit is RM100');
      return;
    }
    if (agreed && (!(Number(agreedPrice) >= 0) || !priceNote.trim())) {
      toast.error('Enter the agreed price and the reason for it.');
      return;
    }
    setCreating(true);

    try {
      // Upload deposit receipt if provided
      let receiptUrl = null;
      if (depositReceipt) {
        const rPath = `receipts/admin_${Date.now()}.${depositReceipt.name.split('.').pop()}`;
        const { error: upErr } = await uploadFileRobust(
          'customer-documents',
          rPath,
          depositReceipt,
          toast
        );
        if (upErr) throw upErr;
        receiptUrl = rPath;
      }

      // One server step: checks the customer is verified and the dates are
      // free, prices it from the car's daily rate, applies credit, records
      // the deposit payment and logs it. "Confirmed" means you have the
      // deposit; "Deposit Paid" leaves it to Verify (receipt) or Mark
      // Deposit Received (cash) on the booking page.
      const { data: booking, error } = await supabase.rpc('bubatrent_admin_create_booking', {
        p_customer_id: selectedCust.id,
        p_car_id: selectedCar.id,
        p_pickup: pickupDate,
        p_return: returnDate,
        p_deposit: depositAmount,
        p_status: initialStatus,
        p_receipt_path: receiptUrl,
        p_use_credit: creditApplied > 0,
        p_notes: notes.trim() || null,
        p_agreed_total: agreed ? calcTotal() : null,
        p_price_note: agreed ? priceNote.trim() : null,
      });
      if (error) throw error;

      toast.success('Booking created successfully');
      navigate(`/admin/bookings/${booking.id}`);
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <AdminLayout title="Book for Customer">
      <button
        onClick={() => navigate('/admin/bookings')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bookings
      </button>

      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {['Customer', 'Car', 'Dates & Deposit', 'Confirm'].map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              step === i + 1
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : step > i + 1
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-white/5 text-slate-500'
            }`}
          >
            {step > i + 1 ? (
              <Check className="w-3 h-3" />
            ) : (
              <span className="w-3 text-center">{i + 1}</span>
            )}
            {s}
          </div>
        ))}
      </div>

      {/* Step 1: Select Customer */}
      {step === 1 && (
        <div className="glass-card max-w-2xl">
          <h3 className="text-sm font-semibold text-white mb-3">Select Customer</h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={custSearch}
              onChange={(e) => handleCustSearch(e.target.value)}
              className="input-field !pl-10"
              placeholder="Search by name, phone, IC, or email..."
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
            )}
          </div>
          {selectedCust ? (
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-violet-400" />
                <div>
                  <p className="text-sm text-white font-medium">
                    {selectedCust.display_name || selectedCust.ic_number}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedCust.phone} {selectedCust.username ? `• ${selectedCust.username}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCust(null)}
                className="text-slate-500 text-xs hover:text-white"
              >
                Change
              </button>
            </div>
          ) : (
            custResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {custResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCust(c);
                      setCustResults([]);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 text-left transition-all"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-white">
                        {c.display_name || c.ic_number || 'Unknown'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {c.phone} {c.username ? `• ${c.username}` : ''}{' '}
                        {bookingBlock(c) ? (
                          <span className="text-amber-400">• {bookingBlock(c)}</span>
                        ) : (
                          <span className="text-green-400">✓ Verified</span>
                        )}
                        {Number(c.deposit_credit) > 0 && (
                          <span className="text-emerald-400">
                            {' '}
                            • {formatMYR(c.deposit_credit)} credit
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
          {bookingBlock(selectedCust) && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {bookingBlock(selectedCust) === 'Not verified'
                  ? 'This customer is not verified yet. Check their IC and licence and press Verify Customer on '
                  : 'This customer’s driving licence has expired. Update the expiry date on '}
                <Link
                  to={
                    bookingBlock(selectedCust) === 'Not verified'
                      ? '/admin/customers?verification=not_verified'
                      : '/admin/customers'
                  }
                  className="underline hover:text-amber-200"
                >
                  Customers
                </Link>{' '}
                first.
              </span>
            </div>
          )}
          <button
            onClick={() => step === 1 && selectedCust && !bookingBlock(selectedCust) && setStep(2)}
            disabled={!selectedCust || !!bookingBlock(selectedCust)}
            className="btn-primary w-full mt-4 disabled:opacity-30"
          >
            Next → Select Car
          </button>
        </div>
      )}

      {/* Step 2: Select Car */}
      {step === 2 && (
        <div className="glass-card max-w-2xl">
          <h3 className="text-sm font-semibold text-white mb-3">
            Select Car — {activeFleet?.name}
          </h3>
          {carsLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cars.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCar(c)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                    selectedCar?.id === c.id
                      ? 'bg-violet-500/10 border-violet-500/30'
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  {c.image_url && (
                    <img src={c.image_url} className="w-14 h-10 rounded-lg object-cover" alt="" />
                  )}
                  <div>
                    <p className="text-sm text-white font-medium">
                      {c.name || `${c.brand} ${c.model}`}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      RM{c.price_per_day}/day • {c.plate_number}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={() => selectedCar && setStep(3)}
              disabled={!selectedCar}
              className="btn-primary flex-1 disabled:opacity-30"
            >
              Next → Dates
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Dates & Deposit */}
      {step === 3 && (
        <div className="glass-card max-w-2xl">
          <h3 className="text-sm font-semibold text-white mb-3">Dates & Deposit</h3>

          {/* Existing bookings for this car */}
          {existingBookings.length > 0 && (
            <div className="mb-4 rounded-xl border border-white/10 overflow-hidden">
              <div className="px-3 py-2 bg-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Existing bookings for {selectedCar?.name}
              </div>
              <div className="divide-y divide-white/5 max-h-36 overflow-y-auto">
                {existingBookings.map((b) => (
                  <div
                    key={b.id}
                    className={`px-3 py-2 flex items-center justify-between text-xs ${
                      BLOCKING_STATUSES.includes(b.status) ? 'bg-red-500/5' : 'bg-yellow-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          BLOCKING_STATUSES.includes(b.status) ? 'bg-red-400' : 'bg-yellow-400'
                        }`}
                      />
                      <span className="text-slate-300">
                        {b.pickup_date} → {b.return_date}
                      </span>
                      {b.customer_name && (
                        <span className="text-slate-500">({b.customer_name})</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        BLOCKING_STATUSES.includes(b.status)
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}
                    >
                      {b.status === 'HOLD' ? 'Checkout hold' : b.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-1.5 bg-white/[0.02] text-[10px] text-slate-500 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Blocks dates
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Online checkout in
                  progress (frees up within 10 minutes if not paid)
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="input-label">Pickup Date *</label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                min={getTodayString()}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Return Date *</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={pickupDate || getTodayString()}
                className="input-field"
              />
            </div>
          </div>
          {dateError && (
            <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {dateError}
            </p>
          )}
          {/* Real-time overlap warning */}
          {pickupDate && returnDate && getOverlap() && !dateError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                These dates overlap with a <strong>{getOverlap().status}</strong> booking (
                {getOverlap().pickup_date} → {getOverlap().return_date}). You won&apos;t be able to
                proceed.
              </span>
            </div>
          )}
          {pickupDate && returnDate && selectedCar && !getOverlap() && (
            <div className="bg-white/5 rounded-xl p-3 mb-3 space-y-2">
              <p className="text-sm text-white">
                Price: <strong>{formatMYR(estimate.total)}</strong> ({estimate.days} days × RM
                {selectedCar.price_per_day}
                {estimate.longDiscount > 0 &&
                  `, ${longRentalLabel(estimate.days, estimate.discountPct).toLowerCase()} −${formatMYR(estimate.longDiscount)}`}
                )
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="input-label">Agreed price (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={agreedPrice}
                    onChange={(e) => setAgreedPrice(e.target.value)}
                    placeholder={String(estimate.total)}
                    className="input-field"
                  />
                </div>
                {agreed && (
                  <div>
                    <label className="input-label">Reason *</label>
                    <input
                      value={priceNote}
                      onChange={(e) => setPriceNote(e.target.value)}
                      placeholder="e.g. regular customer, agreed on WhatsApp"
                      className="input-field"
                      maxLength={300}
                    />
                  </div>
                )}
              </div>
              {agreed && (
                <p className="text-xs text-amber-300">
                  Total {formatMYR(calcTotal())} ({formatMYR(calcTotal() - estimate.total)} on the
                  normal price). The invoice shows the agreed price and the reason.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="input-label">Deposit (min RM100) *</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => {
                  setDepositTouched(true);
                  setDepositInput(Number(e.target.value));
                }}
                min={100}
                className="input-field"
              />
              {estimate.days > 0 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Online rule for this price: {formatMYR(depositRule)} (30% of the rental, at least
                  RM100).
                  {depositTouched && Number(depositAmount) !== depositRule && (
                    <button
                      type="button"
                      onClick={() => setDepositTouched(false)}
                      className="ml-1 text-violet-400 hover:text-violet-300"
                    >
                      Use it
                    </button>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="input-label">Initial Status</label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value)}
                className="input-field"
              >
                <option value="DEPOSIT_PAID">Deposit Paid</option>
                <option value="CONFIRMED">Confirmed</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {toCollect === 0
                  ? 'Credit pays the whole deposit: it is recorded as received now.'
                  : initialStatus === 'CONFIRMED'
                    ? 'You have the deposit: it is recorded as received now.'
                    : 'Deposit still to check: Verify the receipt, or Mark Deposit Received for cash, on the booking page.'}
              </p>
            </div>
          </div>
          {credit > 0 && (
            <label className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2.5 mb-3 text-xs text-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Use the customer&apos;s credit ({formatMYR(credit)} available) towards the deposit.
                {useCredit && (
                  <>
                    {' '}
                    {formatMYR(creditApplied)} from credit,{' '}
                    <strong>{formatMYR(toCollect)} to collect</strong>.
                  </>
                )}
              </span>
            </label>
          )}
          <div className="mb-3">
            <label className="input-label">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="e.g. phone booking, pickup at the office"
              maxLength={500}
            />
          </div>
          <div className="mb-3">
            <label className="input-label">Deposit Receipt (optional)</label>
            <label
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs cursor-pointer border ${depositReceipt ? 'bg-green-500/5 border-green-500/20 text-green-300' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              <FileImage className="w-4 h-4" />
              <span className="truncate">
                {depositReceipt?.name || 'Upload deposit receipt...'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setDepositReceipt(e.target.files[0])}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={() => {
                if (validateDates()) setStep(4);
              }}
              disabled={!!getOverlap()}
              className="btn-primary flex-1 disabled:opacity-30"
            >
              Review & Confirm
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div className="glass-card max-w-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">Review Booking</h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Customer:</span>
              <span className="text-white">
                {selectedCust?.display_name || selectedCust?.ic_number}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Car:</span>
              <span className="text-white">
                {selectedCar?.name || `${selectedCar?.brand} ${selectedCar?.model}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Dates:</span>
              <span className="text-white">
                {pickupDate} → {returnDate}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total:</span>
              <span className="text-white font-semibold">{formatMYR(calcTotal())}</span>
            </div>
            {agreed && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-400">Agreed price:</span>
                <span className="text-amber-300 text-right">
                  normal {formatMYR(estimate.total)} · {priceNote.trim() || 'reason needed'}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Deposit:</span>
              <span className="text-white">{formatMYR(depositAmount)}</span>
            </div>
            {creditApplied > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">From credit:</span>
                <span className="text-emerald-400">
                  {formatMYR(creditApplied)} ({formatMYR(toCollect)} to collect)
                </span>
              </div>
            )}
            {notes.trim() && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-400">Notes:</span>
                <span className="text-white text-right">{notes.trim()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Status:</span>
              <span className="text-green-400">{initialStatus}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Fleet:</span>
              <span className="text-white">{activeFleet?.name}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {creating ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
