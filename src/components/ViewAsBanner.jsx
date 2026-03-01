import { useViewAs } from '../hooks/ViewAsContext';
import { Eye, X, Users, Shield } from 'lucide-react';

/**
 * Sticky top banner shown when View As mode is active.
 * Shows the simulated role and provides an exit button.
 */
export default function ViewAsBanner() {
  const { viewAs, isViewMode, exitViewAs } = useViewAs();

  if (!isViewMode) return null;

  const roleLabel = viewAs.role === 'customer'
    ? 'Customer'
    : `Group Admin — ${viewAs.fleetName || 'Unknown Group'}`;

  const statusLabel = viewAs.role === 'group_admin' && viewAs.fleetStatus
    ? ` (${viewAs.fleetStatus})`
    : '';

  const bgColor = viewAs.role === 'customer'
    ? 'from-blue-600/90 to-blue-700/90'
    : viewAs.fleetStatus === 'SUSPENDED'
      ? 'from-red-600/90 to-red-700/90'
      : viewAs.fleetStatus === 'PENDING_VERIFICATION'
        ? 'from-amber-600/90 to-amber-700/90'
        : 'from-violet-600/90 to-violet-700/90';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r ${bgColor} backdrop-blur-md shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10">
            <Eye className="w-3.5 h-3.5 text-white/80" />
            <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider">View Mode</span>
          </div>
          <div className="flex items-center gap-1.5">
            {viewAs.role === 'customer'
              ? <Users className="w-4 h-4 text-white/70" />
              : <Shield className="w-4 h-4 text-white/70" />}
            <span className="text-sm text-white font-medium">
              Viewing as: <strong>{roleLabel}</strong>{statusLabel}
            </span>
          </div>
        </div>
        <button
          onClick={exitViewAs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all"
        >
          <X className="w-3.5 h-3.5" />
          Exit View Mode
        </button>
      </div>
    </div>
  );
}
