import { useFleet } from '../hooks/useFleet';
import { ShieldAlert, Clock, XCircle, AlertTriangle } from 'lucide-react';

/**
 * Shows status banners for non-verified or suspended groups.
 * Wraps admin page content — blocks sensitive actions as needed.
 */
export default function GroupStatusGuard({ children }) {
  const { groupStatus, isSuperGroup, activeFleet, loading } = useFleet();

  if (loading) return null;

  // Super Group always has full access
  if (isSuperGroup) return children;

  if (groupStatus === 'SUSPENDED') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="glass-card max-w-lg text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Group Suspended</h2>
          <p className="text-sm text-slate-400">
            <strong className="text-white">{activeFleet?.name}</strong> has been suspended by the Super Group administrator.
          </p>
          {activeFleet?.suspension_reason && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-left">
              <p className="text-xs text-red-300 font-semibold uppercase mb-1">Reason</p>
              <p className="text-sm text-slate-300">{activeFleet.suspension_reason}</p>
            </div>
          )}
          <p className="text-xs text-slate-500">
            All write operations and access to sensitive data are blocked while suspended.
            Please contact the Super Group administrator to resolve this issue.
          </p>
        </div>
      </div>
    );
  }

  if (groupStatus === 'PENDING_VERIFICATION') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Your group is pending Super Group verification</p>
            <p className="text-xs text-slate-400 mt-1">
              <strong>{activeFleet?.name}</strong> is awaiting approval from the Super Group.
              You can set up your group, but access to customer verification data and sensitive operations is restricted.
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  if (groupStatus === 'REJECTED') {
    return (
      <div className="space-y-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Group registration rejected</p>
            <p className="text-xs text-slate-400 mt-1">
              <strong>{activeFleet?.name}</strong> was rejected by the Super Group.
              {activeFleet?.rejection_reason && (
                <> Reason: <em className="text-slate-300">{activeFleet.rejection_reason}</em></>
              )}
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // VERIFIED — full access
  return children;
}
