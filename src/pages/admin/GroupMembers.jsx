import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  Users, UserPlus, Shield, ShieldCheck, Trash2, Loader2,
  Search, ChevronDown, X, Crown
} from 'lucide-react';

const ROLE_CONFIG = {
  fleet_admin: { label: 'Fleet Admin', icon: ShieldCheck, color: 'violet', desc: 'Full management access' },
  fleet_staff: { label: 'Staff', icon: Shield, color: 'slate', desc: 'View & limited actions' },
};

export default function GroupMembers() {
  const { user, isSuperAdmin } = useAuth();
  const { activeFleetId, activeFleet } = useFleet();
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add member state
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [addRole, setAddRole] = useState('fleet_staff');
  const [adding, setAdding] = useState(false);

  // Confirm modals
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [roleChange, setRoleChange] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { if (activeFleetId) fetchMembers(); }, [activeFleetId]);

  async function fetchMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('bubatrent_booking_fleet_memberships')
      .select('*, bubatrent_booking_profiles(id, display_name, username, role)')
      .eq('fleet_group_id', activeFleetId)
      .order('created_at');
    if (error) console.error('Error fetching members:', error);
    setMembers(data || []);
    setLoading(false);
  }

  async function handleSearch(q) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    // Search profiles by display_name, username, or email
    const { data } = await supabase
      .from('bubatrent_booking_profiles')
      .select('id, display_name, username, role')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .in('role', ['admin', 'super_admin'])
      .limit(10);
    // Filter out already-members
    const memberIds = members.map(m => m.user_id);
    setSearchResults((data || []).filter(u => !memberIds.includes(u.id)));
    setSearching(false);
  }

  async function handleAddMember() {
    if (!selectedUser) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from('bubatrent_booking_fleet_memberships')
        .insert({
          user_id: selectedUser.id,
          fleet_group_id: activeFleetId,
          role: addRole,
        });
      if (error) {
        if (error.code === '23505') toast.error('This user is already a member');
        else throw error;
      } else {
        // Audit log
        await supabase.from('bubatrent_booking_audit_logs').insert({
          admin_id: user.id,
          action: 'ADD_GROUP_MEMBER',
          resource_type: 'fleet_membership',
          resource_id: activeFleetId,
          details: { added_user: selectedUser.id, role: addRole, group: activeFleet?.name },
        });
        toast.success(`${selectedUser.display_name || selectedUser.username} added as ${ROLE_CONFIG[addRole].label}`);
        setShowAdd(false);
        setSelectedUser(null);
        setSearchQuery('');
        setSearchResults([]);
        await fetchMembers();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(membership, newRole) {
    setActionLoading(membership.id);
    try {
      const { error } = await supabase
        .from('bubatrent_booking_fleet_memberships')
        .update({ role: newRole })
        .eq('id', membership.id);
      if (error) throw error;

      await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: user.id,
        action: 'CHANGE_MEMBER_ROLE',
        resource_type: 'fleet_membership',
        resource_id: membership.id,
        details: { target_user: membership.user_id, old_role: membership.role, new_role: newRole, group: activeFleet?.name },
      });

      toast.success('Role updated');
      setRoleChange(null);
      await fetchMembers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(membership) {
    setActionLoading(membership.id);
    try {
      const { error } = await supabase
        .from('bubatrent_booking_fleet_memberships')
        .delete()
        .eq('id', membership.id);
      if (error) throw error;

      await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: user.id,
        action: 'REMOVE_GROUP_MEMBER',
        resource_type: 'fleet_membership',
        resource_id: membership.id,
        details: { removed_user: membership.user_id, group: activeFleet?.name },
      });

      toast.success('Member removed');
      setRemoveConfirm(null);
      await fetchMembers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const isFleetAdmin = members.some(m => m.user_id === user?.id && m.role === 'fleet_admin');
  const canManage = isSuperAdmin || isFleetAdmin;

  return (
    <AdminLayout title={`Members — ${activeFleet?.name || 'Fleet'}`}>
      <p className="text-sm text-slate-400 mb-4">
        Manage who has access to this fleet group. Members can switch between groups they belong to.
      </p>

      {/* Add Member */}
      {canManage && (
        <div className="mb-6">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 transition-all"
            >
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          ) : (
            <div className="glass-card animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Add Member to {activeFleet?.name}</h3>
                <button onClick={() => { setShowAdd(false); setSelectedUser(null); setSearchQuery(''); setSearchResults([]); }}
                  className="p-1 rounded-lg hover:bg-white/5 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  className="input-field !pl-10"
                  placeholder="Search by name or email..."
                  autoFocus
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />}
              </div>

              {/* Search results */}
              {searchResults.length > 0 && !selectedUser && (
                <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                  {searchResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setSearchResults([]); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 text-left transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-xs font-bold text-violet-300">
                        {(u.display_name || u.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{u.display_name || u.username}</p>
                        <p className="text-[10px] text-slate-500">{u.username} • {u.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedUser && (
                <p className="text-xs text-slate-500 mb-3">No matching admin users found</p>
              )}

              {/* Selected user */}
              {selectedUser && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-xs font-bold text-violet-300">
                        {(selectedUser.display_name || selectedUser.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{selectedUser.display_name || selectedUser.username}</p>
                        <p className="text-[10px] text-slate-500">{selectedUser.username}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Role selector + Add button */}
              {selectedUser && (
                <div className="flex gap-2">
                  <select
                    value={addRole}
                    onChange={e => setAddRole(e.target.value)}
                    className="input-field flex-1"
                  >
                    <option value="fleet_admin">Fleet Admin</option>
                    <option value="fleet_staff">Staff</option>
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={adding}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 transition-all disabled:opacity-50"
                  >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      {loading ? <LoadingSpinner /> : members.length === 0 ? (
        <EmptyState icon={Users} title="No members" description="This fleet group has no members yet." />
      ) : (
        <div className="space-y-2">
          {members.map(m => {
            const profile = m.bubatrent_booking_profiles;
            const roleInfo = ROLE_CONFIG[m.role] || ROLE_CONFIG.fleet_staff;
            const RoleIcon = roleInfo.icon;
            const isCreator = activeFleet?.created_by === m.user_id;
            const isSelf = m.user_id === user?.id;

            return (
              <div key={m.id} className="glass-card flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                    {(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium truncate">
                        {profile?.display_name || profile?.username || 'Unknown'}
                      </p>
                      {isCreator && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-semibold">
                          <Crown className="w-2.5 h-2.5" /> Owner
                        </span>
                      )}
                      {isSelf && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300 font-semibold">You</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{profile?.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Role badge */}
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-${roleInfo.color}-500/10 text-${roleInfo.color}-400 border border-${roleInfo.color}-500/20`}>
                    <RoleIcon className="w-3 h-3" /> {roleInfo.label}
                  </span>

                  {/* Actions — only if can manage and not self */}
                  {canManage && !isSelf && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setRoleChange(m)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-violet-400 transition-colors"
                        title="Change role"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRemoveConfirm(m)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Change Modal */}
      {roleChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setRoleChange(null)}>
          <div className="glass-card w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Change Role</h3>
            <p className="text-sm text-slate-400 mb-4">
              Change <strong>{roleChange.bubatrent_booking_profiles?.display_name}</strong>'s role in this group:
            </p>
            <div className="space-y-2 mb-4">
              {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handleRoleChange(roleChange, key)}
                  disabled={roleChange.role === key || actionLoading === roleChange.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    roleChange.role === key
                      ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  } disabled:opacity-50`}
                >
                  <cfg.icon className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium">{cfg.label}</p>
                    <p className="text-[10px] text-slate-500">{cfg.desc}</p>
                  </div>
                  {roleChange.role === key && <span className="ml-auto text-[10px] text-violet-400">Current</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setRoleChange(null)} className="btn-secondary w-full">Cancel</button>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setRemoveConfirm(null)}>
          <div className="glass-card w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Remove Member</h3>
            <p className="text-sm text-slate-400 mb-4">
              Are you sure you want to remove <strong>{removeConfirm.bubatrent_booking_profiles?.display_name}</strong> from this group? They will lose access to all group data.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRemoveConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => handleRemove(removeConfirm)}
                disabled={actionLoading === removeConfirm.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading === removeConfirm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
