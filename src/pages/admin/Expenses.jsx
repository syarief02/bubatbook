import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useFleet } from '../../hooks/useFleet';
import { supabase } from '../../lib/supabase';
import { uploadFileRobust } from '../../lib/uploadHelper';
import { useToast } from '../../components/Toast';
import { formatMYR } from '../../utils/pricing';
import { formatDate, getTodayString, periodRange, inPeriod } from '../../utils/dates';
import { friendlyDbError } from '../../utils/dbErrors';
import { expensePaid, expensePending, sumBy } from '../../utils/revenue';
import {
  Receipt,
  Plus,
  Upload,
  CheckCircle,
  Clock,
  FileImage,
  Loader2,
  ChevronDown,
  ChevronUp,
  Filter,
  Trash2,
} from 'lucide-react';

import { SignedLink } from '../../components/SignedFile';

const BUCKET = 'customer-documents';

// A repair the customer paid the workshop for directly: recorded and removed
// on their booking (Paid to Workshop), not here
function paidByCustomer(claim) {
  return claim.bubatrent_booking_workshop_payments?.[0] || null;
}

export default function AdminExpenses() {
  const { activeFleetId } = useFleet();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [people, setPeople] = useState({});
  const [cars, setCars] = useState([]);
  const [tab, setTab] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [carFilter, setCarFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form state
  const [formCarId, setFormCarId] = useState('');
  const [formDate, setFormDate] = useState(getTodayString());
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFiles, setFormFiles] = useState([]);

  // Payment receipt state
  const [receiptFile, setReceiptFile] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeFleetId]);

  async function fetchData() {
    setLoading(true);
    let claimsQ = supabase
      .from('bubatrent_booking_expense_claims')
      .select(
        '*, bubatrent_booking_cars(name), bubatrent_booking_expense_images(*), bubatrent_booking_workshop_payments(booking_id)'
      )
      .order('created_at', { ascending: false });
    let carsQ = supabase.from('bubatrent_booking_cars').select('id, name');
    if (activeFleetId) {
      claimsQ = claimsQ.eq('fleet_group_id', activeFleetId);
      carsQ = carsQ.eq('fleet_group_id', activeFleetId);
    }
    const [{ data: claimsData }, { data: carsData }] = await Promise.all([claimsQ, carsQ]);
    // Names of who submitted and who paid each claim
    const ids = [
      ...new Set(
        (claimsData || []).flatMap((c) => [c.submitted_by, c.completed_by]).filter(Boolean)
      ),
    ];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('bubatrent_booking_profiles')
        .select('id, display_name, email')
        .in('id', ids);
      setPeople(Object.fromEntries((profiles || []).map((p) => [p.id, p.display_name || p.email])));
    }
    setClaims(claimsData || []);
    setCars(carsData || []);
    setLoading(false);
  }

  async function handleSubmitClaim(e) {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (!formCarId || !formDate || !formDesc.trim() || formFiles.length === 0) {
      toast.error('Please fill all fields and upload at least 1 invoice image.');
      return;
    }
    if (!(amount > 0)) {
      toast.error('Enter the amount of the claim.');
      return;
    }
    if (formDate > getTodayString()) {
      toast.error('The expense date can’t be in the future.');
      return;
    }
    setSubmitting(true);
    // Images go up first, so a failed upload leaves no half-saved claim
    const claimId = crypto.randomUUID();
    const paths = [];
    let saved = false;
    try {
      for (const file of formFiles) {
        const ext = file.name.split('.').pop();
        const path = `expenses/${claimId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await uploadFileRobust(BUCKET, path, file, toast);
        if (upErr) throw upErr;
        paths.push(path);
      }

      // The database checks the claim and records who submitted it
      const { error: claimErr } = await supabase.from('bubatrent_booking_expense_claims').insert({
        id: claimId,
        car_id: formCarId === 'others' ? null : formCarId,
        expense_date: formDate,
        description: formDesc.trim(),
        total_amount: amount,
        fleet_group_id: activeFleetId,
      });
      if (claimErr) throw claimErr;
      saved = true;

      const { error: imgErr } = await supabase
        .from('bubatrent_booking_expense_images')
        .insert(paths.map((file_path) => ({ claim_id: claimId, file_path })));
      if (imgErr) {
        await supabase.from('bubatrent_booking_expense_claims').delete().eq('id', claimId);
        saved = false;
        throw imgErr;
      }

      toast.success('Claim submitted!');
      setShowForm(false);
      setFormCarId('');
      setFormDesc('');
      setFormAmount('');
      setFormFiles([]);
      await fetchData();
    } catch (err) {
      if (!saved && paths.length) await supabase.storage.from(BUCKET).remove(paths);
      toast.error(friendlyDbError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteClaim(claimId) {
    if (!receiptFile) {
      toast.error('Upload your payment receipt first.');
      return;
    }
    setCompletingId(claimId);
    try {
      const ext = receiptFile.name.split('.').pop();
      const path = `expenses/${claimId}/receipt_${Date.now()}.${ext}`;
      const { error: upErr } = await uploadFileRobust(BUCKET, path, receiptFile, toast);
      if (upErr) throw upErr;

      // The database records who paid it and when
      const { error } = await supabase
        .from('bubatrent_booking_expense_claims')
        .update({ status: 'completed', payment_receipt_path: path })
        .eq('id', claimId);
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }

      toast.success('Claim marked as completed!');
      setReceiptFile(null);
      await fetchData();
    } catch (err) {
      toast.error(friendlyDbError(err));
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDeleteClaim(claim) {
    if (
      !window.confirm(
        `Delete claim "${claim.description}"? This cannot be undone. The deletion is kept in the audit log.`
      )
    )
      return;
    setDeletingId(claim.id);
    try {
      // Delete the claim first (its image rows go with it), then its files
      const { data: deleted, error } = await supabase
        .from('bubatrent_booking_expense_claims')
        .delete()
        .eq('id', claim.id)
        .select('id');
      if (error) throw error;
      if (!deleted?.length) throw new Error('The claim could not be deleted (permission denied).');
      const paths = (claim.bubatrent_booking_expense_images || []).map((img) => img.file_path);
      if (claim.payment_receipt_path) paths.push(claim.payment_receipt_path);
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      toast.success('Claim deleted.');
      setExpanded(null);
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  // Date range from the preset (Malaysia calendar days)
  const today = getTodayString();
  const period = periodRange(datePreset, dateFrom, dateTo);

  // Claims for the chosen car and dates; the tabs then pick a status
  const matchingClaims = claims.filter((c) => {
    if (carFilter === 'others' && c.car_id !== null) return false;
    if (carFilter !== 'all' && carFilter !== 'others' && c.car_id !== carFilter) return false;
    return inPeriod(c.expense_date, period);
  });
  const filteredClaims = matchingClaims.filter((c) => tab === 'all' || c.status === tab);

  const totalPaid = sumBy(matchingClaims, expensePaid);
  const totalPending = sumBy(matchingClaims, expensePending);
  const filtersOn = carFilter !== 'all' || datePreset !== 'all';

  if (loading)
    return (
      <AdminLayout title="Expenses">
        <LoadingSpinner />
      </AdminLayout>
    );

  return (
    <AdminLayout title="Expenses & Claims">
      {/* Summary */}
      <div className="glass-card mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Expenses (Completed)</p>
          <p className="text-xl font-bold text-white">{formatMYR(totalPaid)}</p>
          <p className="text-[11px] text-slate-500">
            {formatMYR(totalPending)} waiting to be paid
            {filtersOn ? ' · for the car and dates selected below' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Submit Claim
        </button>
      </div>

      {/* Submit Form */}
      {showForm && (
        <div className="glass-card mb-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-white mb-4">New Expense Claim</h3>
          <form onSubmit={handleSubmitClaim} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="input-label">Car *</label>
                <select
                  value={formCarId}
                  onChange={(e) => setFormCarId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select car</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="others">Others (General)</option>
                </select>
              </div>
              <div>
                <label className="input-label">Expense Date *</label>
                <input
                  type="date"
                  value={formDate}
                  max={today}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Amount (RM) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 50"
                />
              </div>
            </div>
            <div>
              <label className="input-label">Description *</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="input-field"
                rows={2}
                placeholder="e.g. Car wash + interior cleaning"
              />
            </div>
            <div>
              <label className="input-label">Invoice Images * (multiple allowed)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => setFormFiles(Array.from(e.target.files))}
                className="text-sm text-slate-400"
              />
              {formFiles.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{formFiles.length} file(s) selected</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary !py-2 text-sm flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Submit Claim
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary !py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs + Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {[
          ['pending', 'Pending'],
          ['completed', 'Completed'],
          ['all', 'All'],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === val ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            {label}
          </button>
        ))}
        <select
          value={carFilter}
          onChange={(e) => setCarFilter(e.target.value)}
          className="ml-auto input-field !py-1.5 !px-3 text-xs w-40"
        >
          <option value="all">All Cars</option>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="others">Others (General)</option>
        </select>
      </div>
      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-slate-500" />
        {[
          ['all', 'All Time'],
          ['today', 'Today'],
          ['month', 'This Month'],
          ['custom', 'Custom'],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => {
              setDatePreset(val);
              if (val !== 'custom') {
                setDateFrom('');
                setDateTo('');
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${datePreset === val ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field !py-1.5 !px-3 text-xs w-40"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field !py-1.5 !px-3 text-xs w-40"
          />
        </div>
      )}

      {/* Claims List */}
      {filteredClaims.length === 0 ? (
        <div className="glass-card text-center text-sm text-slate-500 italic py-8">
          No claims found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => (
            <div key={claim.id} className="glass-card !p-4">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => {
                  setExpanded(expanded === claim.id ? null : claim.id);
                  setReceiptFile(null);
                }}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${claim.status === 'completed' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}
                >
                  {claim.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{claim.description}</p>
                  {paidByCustomer(claim) && (
                    <p className="text-[11px] text-cyan-400">
                      Paid by the customer to the workshop
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {claim.bubatrent_booking_cars?.name || 'Others (General)'} ·{' '}
                    {formatDate(claim.expense_date)}
                    {claim.total_amount && ` · ${formatMYR(claim.total_amount)}`}
                  </p>
                </div>
                {expanded === claim.id ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>

              {expanded === claim.id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-fade-in">
                  <p className="text-xs text-slate-500">
                    Submitted by {people[claim.submitted_by] || 'an admin'} on{' '}
                    {formatDate(claim.created_at)}
                  </p>
                  {/* Invoice images */}
                  {claim.bubatrent_booking_expense_images?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Invoice Images:</p>
                      <div className="flex gap-2 flex-wrap">
                        {claim.bubatrent_booking_expense_images.map((img) => (
                          <SignedLink
                            key={img.id}
                            path={img.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                          >
                            <FileImage className="w-6 h-6 text-slate-400" />
                          </SignedLink>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Complete claim */}
                  {claim.status === 'pending' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{receiptFile ? receiptFile.name : 'Upload payment receipt'}</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => setReceiptFile(e.target.files[0])}
                          />
                        </label>
                        <button
                          onClick={() => handleCompleteClaim(claim.id)}
                          disabled={completingId === claim.id}
                          className="btn-primary !px-3 !py-1.5 text-xs flex items-center gap-1"
                        >
                          {completingId === claim.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Mark Complete
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteClaim(claim)}
                        disabled={deletingId === claim.id}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        {deletingId === claim.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete Claim
                      </button>
                    </div>
                  )}

                  {claim.status === 'completed' && paidByCustomer(claim) && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs text-green-400">
                        Paid by the customer directly to the workshop on{' '}
                        {formatDate(claim.expense_date)}, and taken off what they owe us.
                      </p>
                      {claim.payment_receipt_path && (
                        <SignedLink
                          path={claim.payment_receipt_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                        >
                          <FileImage className="w-3.5 h-3.5" /> Proof of Payment
                        </SignedLink>
                      )}
                      <Link
                        to={`/admin/bookings/${paidByCustomer(claim).booking_id}`}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        Open booking (remove it there) →
                      </Link>
                    </div>
                  )}

                  {claim.status === 'completed' && !paidByCustomer(claim) && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {claim.completed_at && (
                          <p className="text-xs text-green-400">
                            Paid by {people[claim.completed_by] || 'an admin'} on{' '}
                            {formatDate(claim.completed_at)}
                          </p>
                        )}
                        {claim.payment_receipt_path && (
                          <SignedLink
                            path={claim.payment_receipt_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                          >
                            <FileImage className="w-3.5 h-3.5" /> Payment Receipt
                          </SignedLink>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteClaim(claim)}
                        disabled={deletingId === claim.id}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        {deletingId === claim.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
