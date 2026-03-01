import { useState, useEffect } from 'react';
import { useViewAs } from '../hooks/ViewAsContext';
import { supabase } from '../lib/supabase';
import { Eye, Users, Shield, X, ChevronRight, Building2 } from 'lucide-react';

/**
 * Modal for Super Admin to select View As mode.
 * - Customer view
 * - Group Admin view (select fleet + status)
 */
export default function ViewAsSelector({ isOpen, onClose }) {
  const { enterViewAs } = useViewAs();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('VERIFIED');

  useEffect(() => {
    if (isOpen) fetchGroups();
  }, [isOpen]);

  async function fetchGroups() {
    setLoading(true);
    const { data } = await supabase
      .from('bubatrent_booking_fleet_groups')
      .select('id, name, slug, status, is_super_group')
      .order('name');
    setGroups(data || []);
    setLoading(false);
  }

  function handleCustomerView() {
    enterViewAs({ role: 'customer' });
    onClose();
  }

  function handleGroupAdminView() {
    if (!selectedGroup) return;
    enterViewAs({
      role: 'group_admin',
      fleetId: selectedGroup.id,
      fleetName: selectedGroup.name,
      fleetStatus: selectedStatus,
      isSuperGroup: selectedGroup.is_super_group,
    });
    onClose();
  }

  if (!isOpen) return null;

  const STATUS_OPTIONS = [
    { value: 'PENDING_VERIFICATION', label: 'Pending Verification', color: 'amber' },
    { value: 'VERIFIED', label: 'Verified', color: 'green' },
    { value: 'REJECTED', label: 'Rejected', color: 'red' },
    { value: 'SUSPENDED', label: 'Suspended', color: 'red' },
  ];

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-lg animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">View As</h2>
              <p className="text-xs text-slate-500">See exactly what other users see</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer View */}
        <button
          onClick={handleCustomerView}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-all mb-3 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">View as Customer</p>
              <p className="text-[10px] text-slate-500">See the homepage, bookings, and profile as a customer</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
        </button>

        {/* Group Admin View */}
        <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">View as Group Admin</p>
              <p className="text-[10px] text-slate-500">Select a fleet group and simulate its status</p>
            </div>
          </div>

          {/* Fleet group selector */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Select Fleet Group</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-slate-500 py-2">Loading groups...</p>
                ) : groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroup(g)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all ${
                      selectedGroup?.id === g.id
                        ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">{g.name}</span>
                    {g.is_super_group && (
                      <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] bg-violet-500/20 text-violet-300">Super</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Status override */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Simulate Group Status</label>
              <div className="grid grid-cols-2 gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedStatus(s.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      selectedStatus === s.value
                        ? `bg-${s.color}-500/15 text-${s.color}-400 border border-${s.color}-500/30`
                        : 'bg-white/5 text-slate-500 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGroupAdminView}
              disabled={!selectedGroup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Eye className="w-4 h-4" />
              Enter View Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
