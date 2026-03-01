import { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Building2, Mail, Phone, MessageCircle, Save, Loader2, Pencil, Plus } from 'lucide-react';

export default function FleetSettings() {
  const { user, isSuperAdmin } = useAuth();
  const { activeFleet, fleets, refetchFleets, activeFleetId } = useFleet();
  const toast = useToast();

  // Edit settings
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Register new fleet
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', support_email: '', support_phone: '', support_whatsapp: '' });
  const [registering, setRegistering] = useState(false);

  function startEdit() {
    setForm({
      name: activeFleet?.name || '',
      support_email: activeFleet?.support_email || '',
      support_phone: activeFleet?.support_phone || '',
      support_whatsapp: activeFleet?.support_whatsapp || '',
    });
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Fleet name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('bubatrent_booking_fleet_groups')
        .update({
          name: form.name.trim(),
          support_email: form.support_email?.trim() || null,
          support_phone: form.support_phone?.trim() || null,
          support_whatsapp: form.support_whatsapp?.trim() || null,
        })
        .eq('id', activeFleetId);
      if (error) throw error;
      toast.success('Fleet settings updated');
      setEditing(false);
      refetchFleets();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!regForm.name?.trim()) { toast.error('Fleet name is required'); return; }
    setRegistering(true);
    try {
      const slug = regForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: newFleet, error: fleetErr } = await supabase.from('bubatrent_booking_fleet_groups')
        .insert({
          name: regForm.name.trim(),
          slug,
          support_email: regForm.support_email?.trim() || null,
          support_phone: regForm.support_phone?.trim() || null,
          support_whatsapp: regForm.support_whatsapp?.trim() || null,
          created_by: user.id,
        })
        .select().single();
      if (fleetErr) throw fleetErr;

      // Auto-add creator as fleet_admin
      const { error: memErr } = await supabase.from('bubatrent_booking_fleet_memberships')
        .insert({
          user_id: user.id,
          fleet_group_id: newFleet.id,
          role: 'fleet_admin',
        });
      if (memErr) throw memErr;

      // Audit log
      await supabase.from('bubatrent_booking_audit_logs').insert({
        admin_id: user.id,
        action: 'CREATE_FLEET_GROUP',
        resource_type: 'fleet_group',
        resource_id: newFleet.id,
        details: { name: newFleet.name },
      });

      toast.success(`Fleet "${newFleet.name}" created! You are now Fleet Admin.`);
      setShowRegister(false);
      setRegForm({ name: '', support_email: '', support_phone: '', support_whatsapp: '' });
      refetchFleets();
    } catch (err) { toast.error(err.message); }
    finally { setRegistering(false); }
  }

  return (
    <AdminLayout title="Fleet Settings">
      {/* Current Fleet Info */}
      {activeFleet && (
        <div className="glass-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{activeFleet.name}</h2>
                <p className="text-xs text-slate-500">Fleet ID: {activeFleet.id.slice(0, 8)}...</p>
              </div>
            </div>
            {!editing && (
              <button onClick={startEdit} className="btn-secondary flex items-center gap-2 text-sm">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="input-label">Fleet Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label flex items-center gap-1"><Mail className="w-3 h-3" /> Support Email</label>
                  <input value={form.support_email} onChange={e => setForm({ ...form, support_email: e.target.value })} className="input-field" type="email" placeholder="support@example.com" />
                </div>
                <div>
                  <label className="input-label flex items-center gap-1"><Phone className="w-3 h-3" /> Support Phone</label>
                  <input value={form.support_phone} onChange={e => setForm({ ...form, support_phone: e.target.value })} className="input-field" placeholder="+60 12-345 6789" />
                </div>
                <div>
                  <label className="input-label flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp Number</label>
                  <input value={form.support_whatsapp} onChange={e => setForm({ ...form, support_whatsapp: e.target.value })} className="input-field" placeholder="601234567890" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-slate-300">{activeFleet.support_email || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="text-slate-300">{activeFleet.support_phone || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4 text-slate-500" />
                <span className="text-slate-300">{activeFleet.support_whatsapp || 'Not set'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Register New Fleet — accessible to all admins */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Register New Fleet Group</h3>
          {!showRegister && (
            <button onClick={() => setShowRegister(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> New Fleet
            </button>
          )}
        </div>

        {fleets.length > 0 && !showRegister && !isSuperAdmin && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mb-3">
            <p className="text-xs text-blue-300">
              You already manage <strong>{fleets.map(f => f.name).join(', ')}</strong>.
              Creating a new fleet will add it to your groups.
            </p>
          </div>
        )}

        {showRegister && (
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
              <div>
                <label className="input-label">Fleet Name *</label>
                <input value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} className="input-field" placeholder="e.g. MyCompany Cars" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Support Email</label>
                  <input value={regForm.support_email} onChange={e => setRegForm({ ...regForm, support_email: e.target.value })} className="input-field" type="email" />
                </div>
                <div>
                  <label className="input-label">Support Phone</label>
                  <input value={regForm.support_phone} onChange={e => setRegForm({ ...regForm, support_phone: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="input-label">WhatsApp Number</label>
                  <input value={regForm.support_whatsapp} onChange={e => setRegForm({ ...regForm, support_whatsapp: e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRegister(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={registering} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  {registering ? 'Creating...' : 'Create Fleet Group'}
                </button>
              </div>
            </form>
          )}
        </div>

      {/* All Fleets (super admin only) */}
      {isSuperAdmin && fleets.length > 0 && (
        <div className="glass-card mt-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">All Fleet Groups</h3>
          <div className="space-y-2">
            {fleets.map(f => (
              <div key={f.id} className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${f.id === activeFleetId ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-white/5'}`}>
                <div>
                  <p className="text-sm text-white font-medium">{f.name}</p>
                  <p className="text-[10px] text-slate-500">{f.slug} • Created {new Date(f.created_at).toLocaleDateString()}</p>
                </div>
                {f.id === activeFleetId && (
                  <span className="px-2 py-1 rounded-full text-[10px] bg-violet-500/20 text-violet-300">Active</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
