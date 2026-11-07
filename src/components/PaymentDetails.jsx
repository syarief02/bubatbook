import { useState } from 'react';
import { Copy, Check, Download, ShieldCheck, Landmark, QrCode } from 'lucide-react';
import { formatMYR } from '../utils/pricing';
import { formatAccountNumber } from '../data/paymentAccounts';

// Copies a value; shows a tick for a moment
function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers: the number stays selectable to copy by hand
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/20"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// The fleet's bank account and DuitNow QR, with the amount and the reference
// to use. `account` comes from paymentAccountFor(fleetId).
export default function PaymentDetails({ account, amount, reference }) {
  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-slate-300">Transfer</p>
        <p className="text-lg font-bold text-white">{formatMYR(amount)}</p>
      </div>

      {/* Bank transfer */}
      <div className="space-y-2.5">
        <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5 text-violet-400" /> By bank transfer
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500">Account number ({account.bank})</p>
            <p className="font-mono text-base text-white tracking-wide select-all">
              {formatAccountNumber(account.accountNumber)}
            </p>
          </div>
          <CopyButton value={account.accountNumber} label="account number" />
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Account name</p>
          <p className="text-sm font-semibold text-white">{account.holder}</p>
        </div>
        {reference && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500">Reference (so we can match it)</p>
              <p className="font-mono text-sm text-white select-all">{reference}</p>
            </div>
            <CopyButton value={reference} label="reference" />
          </div>
        )}
      </div>

      {/* DuitNow QR */}
      {account.qr && (
        <div className="border-t border-white/5 pt-4">
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-3">
            <QrCode className="w-3.5 h-3.5 text-violet-400" /> Or scan the DuitNow QR
          </p>
          <img
            src={account.qr}
            alt={`DuitNow QR to pay ${account.holder}`}
            className="w-56 max-w-full mx-auto rounded-xl bg-white"
            loading="lazy"
          />
          <p className="text-[11px] text-slate-500 text-center mt-2">
            Any Malaysian banking app or e-wallet. On your phone, save the QR and choose it from
            your gallery in your banking app&apos;s DuitNow QR scanner.
          </p>
          <a
            href={account.qr}
            download="rent2go-duitnow-qr.png"
            className="mt-2 mx-auto flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <Download className="w-3.5 h-3.5" /> Save QR
          </a>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-green-300/90 border-t border-white/5 pt-3">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
        Pay only to {account.holder}. We never ask you to pay into a personal account.
      </p>
    </div>
  );
}
