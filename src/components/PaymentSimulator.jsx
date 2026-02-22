import { useState } from 'react';
import { CreditCard, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { formatMYR } from '../utils/pricing';

export default function PaymentSimulator({ depositAmount, onPaymentComplete, disabled = false }) {
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function handlePay() {
    if (processing || completed) return;
    setProcessing(true);
    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setCompleted(true);
    setProcessing(false);
    onPaymentComplete();
  }

  if (completed) {
    return (
      <div className="glass-card text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Payment Successful!</h3>
        <p className="text-sm text-slate-400">Your deposit of {formatMYR(depositAmount)} has been received.</p>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-1">Pay Deposit</h3>
        <p className="text-sm text-slate-400">Secure your booking with a deposit payment</p>
      </div>

      {/* Simulated card form */}
      <div className="space-y-4">
        <div className="glass-card !p-4 !bg-white/[0.02]">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <span className="text-sm text-slate-300">Simulated Payment</span>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              className="input-field text-sm"
              placeholder="4242 4242 4242 4242"
              defaultValue="4242 4242 4242 4242"
              disabled
            />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" className="input-field text-sm" placeholder="MM/YY" defaultValue="12/28" disabled />
              <input type="text" className="input-field text-sm" placeholder="CVC" defaultValue="123" disabled />
            </div>
          </div>
        </div>

        <div className="bg-violet-500/10 rounded-xl px-4 py-3 text-center">
          <p className="text-sm text-violet-300">
            Amount: <span className="font-bold text-lg">{formatMYR(depositAmount)}</span>
          </p>
        </div>

        <button
          onClick={handlePay}
          disabled={processing || disabled}
          className="btn-primary w-full flex items-center justify-center gap-2 !py-4"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay {formatMYR(depositAmount)} Deposit
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Shield className="w-3.5 h-3.5" />
          <span>Secure simulated payment · No real charges</span>
        </div>
      </div>
    </div>
  );
}
