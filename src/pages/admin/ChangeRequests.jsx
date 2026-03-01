import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/dates';
import {
  FileCheck, CheckCircle, XCircle, Clock, Loader2, ArrowRight,
  ChevronDown, ChevronUp, ShieldAlert
} from 'lucide-react';

const STATUS_STYLE = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const FIELD_LABELS = {
  ic_number: 'IC Number',
  address_line1: 'Address Line 1',
  address_line2: 'Address Line 2',
  city: 'City',
  state: 'State',
  postcode: 'Postcode',
  licence_expiry: 'Licence Expiry',
  is_verified: 'Verification Status',
  verified_at: 'Verified At',
  verified_by: 'Verified By',
};

export default function ChangeRequests() {
  const { user, isSuperAdmin } = useAuth();
  const { isSuperGroup, activeFleetId } = useFleet();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('PENDING');
  const [rejectModal, setRejectModal] = useState(null);

  useEffect(() => { fetchRequests(); }, [filter, activeFleetId]);

  async function fetchRequests() {
    setLoading(true);
    let query = supabase
      .from('bubatrent_booking_change_requests')
      .select('*, bubatrent_booking_fleet_groups(name), bubatrent_booking_profiles!customer_id(display_name, username)')
      .order('created_at', { ascending: false });

    if (filter !== 'ALL') {
      query = query.eq('status', filter);
    }

    // Non-super-group admins only see their own group's requests
    if (!isSuperAdmin || !isSuperGroup) {
      query = query.eq('fleet_group_id', activeFleetId);
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching change requests:', error);
    setRequests(data || []);
    setLoading(false);
  }

  async function handleApprove(request) {
    setActionLoading(request.id);
    try {
      // Apply the changes to the customer profile
      const changes = request.changes;
      const updates = {};
      Object.keys(changes).forEach(field => {
        updates[field] = changes[field].new;
      });

      const { error: profileErr } = await supabase
        .from('bubatrent_booking_profiles')
        .update(updates)
        .eq('id', request.customer_id);
      if (profileErr) throw profileErr;

      // Mark request as approved
      const { error: reqErr } = await supabase
        .from('bubatrent_booking_change_requests')
        .update({
          status: 'APPROVED',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      if (reqErr) throw reqErr;

      // Audit log
      await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: user.id,
        action: 'APPROVE_CHANGE_REQUEST',
        resource_type: 'change_request',
        resource_id: request.id,
        details: { customer_id: request.customer_id, changes },
      });

      toast.success('Change request approved — customer record updated');
      await fetchRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(requestId, reason) {
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('bubatrent_booking_change_requests')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;

      await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: user.id,
        action: 'REJECT_CHANGE_REQUEST',
        resource_type: 'change_request',
        resource_id: requestId,
        details: { reason },
      });

      toast.success('Change request rejected');
      setRejectModal(null);
      await fetchRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AdminLayout title="Change Requests">
      <p className="text-sm text-slate-400 mb-4">
        {isSuperAdmin && isSuperGroup
          ? 'Review and approve/reject sensitive customer data changes from all groups.'
          : 'Track changes you submitted for Super Group approval.'}
      </p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filter === s
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'glass-card text-slate-400 hover:text-white'
            }`}
          >
            {s === 'ALL' ? 'All' : s === 'PENDING' ? '⏳ Pending' : s === 'APPROVED' ? '✅ Approved' : '❌ Rejected'}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : requests.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={filter === 'PENDING' ? 'No pending requests' : 'No change requests'}
          description={filter === 'PENDING' ? 'All change requests have been processed.' : 'No change requests match this filter.'}
        />
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const isExpanded = expandedId === req.id;
            const changes = req.changes || {};
            const changedFields = Object.keys(changes);
            const customer = req.bubatrent_booking_profiles;
            const group = req.bubatrent_booking_fleet_groups;

            return (
              <div key={req.id} className="glass-card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-semibold">
                        {customer?.display_name || customer?.username || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] text-slate-500">{group?.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed • {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    {/* Diff view */}
                    <div className="bg-white/[0.02] rounded-xl p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase">Changes</h4>
                      {changedFields.map(field => (
                        <div key={field} className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400 font-medium min-w-[120px]">{FIELD_LABELS[field] || field}</span>
                          <span className="text-red-400/70 line-through text-xs">{String(changes[field].old || '—')}</span>
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                          <span className="text-green-400 text-xs font-medium">{String(changes[field].new || '—')}</span>
                        </div>
                      ))}
                    </div>

                    {/* Rejection reason */}
                    {req.status === 'REJECTED' && req.rejection_reason && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                        <p className="text-xs text-red-300 font-semibold">Rejection Reason:</p>
                        <p className="text-xs text-slate-300 mt-1">{req.rejection_reason}</p>
                      </div>
                    )}

                    {/* Actions — only for super admin + pending */}
                    {isSuperAdmin && isSuperGroup && req.status === 'PENDING' && (
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all disabled:opacity-50"
                        >
                          {actionLoading === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve & Apply
                        </button>
                        <button
                          onClick={() => setRejectModal({ id: req.id, reason: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="glass-card w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Reject Change Request</h3>
            <div>
              <label className="input-label">Rejection Reason *</label>
              <textarea
                value={rejectModal.reason}
                onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                className="input-field min-h-[80px]"
                placeholder="Explain why this change is being rejected..."
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => handleReject(rejectModal.id, rejectModal.reason)}
                disabled={!rejectModal.reason?.trim() || actionLoading === rejectModal.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading === rejectModal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
