import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  Building2, CheckCircle, XCircle, ShieldAlert, Clock, Loader2,
  Shield, Ban, Undo2, AlertTriangle
} from 'lucide-react';

const STATUS_BADGES = {
  PENDING_VERIFICATION: { label: 'Pending', color: 'amber', icon: Clock },
  VERIFIED: { label: 'Verified', color: 'green', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'red', icon: XCircle },
  SUSPENDED: { label: 'Suspended', color: 'red', icon: ShieldAlert },
};

export default function GroupManagement() {
  const { user, isSuperAdmin } = useAuth();
  const { isSuperGroup } = useFleet();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [modal, setModal] = useState(null); // { type, group, reason, notes }

  useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    setLoading(true);
    const { data } = await supabase
      .from('bubatrent_booking_fleet_groups')
      .select('*')
      .order('created_at', { ascending: true });
    setGroups(data || []);
    setLoading(false);
  }

  if (!isSuperAdmin || !isSuperGroup) {
    return (
      <AdminLayout title="Group Management">
        <div className="glass-card text-center">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-slate-400">Only Super Group administrators can manage groups.</p>
        </div>
      </AdminLayout>
    );
  }

  async function handleAction(type, groupId, reason, notes) {
    setActionLoading(groupId);
    try {
      const updates = {};
      let auditAction = '';

      if (type === 'approve') {
        updates.status = 'VERIFIED';
        updates.verified_at = new Date().toISOString();
        updates.verified_by = user.id;
        updates.rejection_reason = null;
        auditAction = 'APPROVE_GROUP';
      } else if (type === 'reject') {
        updates.status = 'REJECTED';
        updates.rejection_reason = reason;
        auditAction = 'REJECT_GROUP';
      } else if (type === 'suspend') {
        updates.status = 'SUSPENDED';
        updates.suspended_at = new Date().toISOString();
        updates.suspended_by = user.id;
        updates.suspension_reason = reason;
        updates.suspension_notes = notes || null;
        auditAction = 'SUSPEND_GROUP';
      } else if (type === 'unsuspend') {
        updates.status = 'VERIFIED';
        updates.suspended_at = null;
        updates.suspended_by = null;
        updates.suspension_reason = null;
        updates.suspension_notes = null;
        auditAction = 'UNSUSPEND_GROUP';
      }

      const { error: upErr } = await supabase
        .from('bubatrent_booking_fleet_groups')
        .update(updates)
        .eq('id', groupId);
      if (upErr) throw upErr;

      // Audit log
      await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: user.id,
        action: auditAction,
        resource_type: 'fleet_group',
        resource_id: groupId,
        details: { reason, notes, timestamp: new Date().toISOString() },
      });

      toast.success(`Group ${type === 'approve' ? 'approved' : type === 'reject' ? 'rejected' : type === 'suspend' ? 'suspended' : 'unsuspended'} successfully`);
      setModal(null);
      await fetchGroups();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AdminLayout title="Group Management">
      <p className="text-sm text-slate-400 mb-6">Manage tenant groups — approve registrations, suspend for violations, and track status.</p>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-3">
          {groups.map(group => {
            const badge = STATUS_BADGES[group.status] || STATUS_BADGES.PENDING_VERIFICATION;
            const BadgeIcon = badge.icon;
            const isSelf = group.is_super_group;

            return (
              <div key={group.id} className="glass-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{group.name}</h3>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/20">Super Group</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{group.slug} • Created {new Date(group.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-${badge.color}-500/10 text-${badge.color}-400 border border-${badge.color}-500/20`}>
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Suspension info */}
                {group.status === 'SUSPENDED' && group.suspension_reason && (
                  <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-sm">
                    <p className="text-red-300 font-semibold text-xs">Suspension Reason:</p>
                    <p className="text-slate-300 text-xs mt-1">{group.suspension_reason}</p>
                    {group.suspension_notes && <p className="text-slate-500 text-[10px] mt-1">Notes: {group.suspension_notes}</p>}
                    <p className="text-slate-600 text-[10px] mt-1">Suspended {new Date(group.suspended_at).toLocaleString()}</p>
                  </div>
                )}

                {group.status === 'REJECTED' && group.rejection_reason && (
                  <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <p className="text-red-300 font-semibold text-xs">Rejection Reason:</p>
                    <p className="text-slate-300 text-xs mt-1">{group.rejection_reason}</p>
                  </div>
                )}

                {/* Actions — not for self (Super Group) */}
                {!isSelf && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/5">
                    {(group.status === 'PENDING_VERIFICATION' || group.status === 'REJECTED') && (
                      <button
                        onClick={() => handleAction('approve', group.id)}
                        disabled={actionLoading === group.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {group.status === 'PENDING_VERIFICATION' && (
                      <button
                        onClick={() => setModal({ type: 'reject', group })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    {group.status === 'VERIFIED' && (
                      <button
                        onClick={() => setModal({ type: 'suspend', group })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
                      >
                        <Ban className="w-3.5 h-3.5" /> Suspend
                      </button>
                    )}
                    {group.status === 'SUSPENDED' && (
                      <button
                        onClick={() => setModal({ type: 'unsuspend', group })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Unsuspend
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-card w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4 capitalize">{modal.type} Group</h3>
            <p className="text-sm text-slate-400 mb-3">
              {modal.type === 'reject' && `Reject "${modal.group.name}" registration? This will block their access to sensitive data.`}
              {modal.type === 'suspend' && `Suspend "${modal.group.name}"? This will immediately block all write operations and sensitive data access.`}
              {modal.type === 'unsuspend' && `Unsuspend "${modal.group.name}"? This will restore their verified status.`}
            </p>
            <div className="space-y-3">
              <div>
                <label className="input-label">Reason *</label>
                <textarea
                  value={modal.reason || ''}
                  onChange={e => setModal({ ...modal, reason: e.target.value })}
                  className="input-field min-h-[80px]"
                  placeholder="Enter reason..."
                  required
                />
              </div>
              {modal.type === 'suspend' && (
                <div>
                  <label className="input-label">Notes (optional)</label>
                  <textarea
                    value={modal.notes || ''}
                    onChange={e => setModal({ ...modal, notes: e.target.value })}
                    className="input-field min-h-[60px]"
                    placeholder="Internal notes..."
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => handleAction(modal.type, modal.group.id, modal.reason, modal.notes)}
                disabled={!modal.reason?.trim() || actionLoading === modal.group.id}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  modal.type === 'unsuspend'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20'
                } disabled:opacity-50`}
              >
                {actionLoading === modal.group.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {modal.type === 'reject' ? 'Reject' : modal.type === 'suspend' ? 'Suspend Now' : 'Unsuspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
