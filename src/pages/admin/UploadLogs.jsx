import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../utils/dates';
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff,
  Upload, FileSearch, Filter, Smartphone, Monitor, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

const STEP_CONFIG = {
  preflight:     { icon: FileSearch,    color: 'text-slate-400',  bg: 'bg-slate-500/10',  label: 'Preflight' },
  reading_file:  { icon: Clock,         color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'Reading' },
  uploading:     { icon: Upload,        color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Uploading' },
  progress:      { icon: Upload,        color: 'text-indigo-400', bg: 'bg-indigo-500/10', label: 'Progress' },
  success:       { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-500/10',  label: 'Success' },
  error:         { icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10',    label: 'Error' },
  timeout:       { icon: Clock,         color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Timeout' },
  network_error: { icon: WifiOff,       color: 'text-red-400',    bg: 'bg-red-500/10',    label: 'Network Error' },
};

function isMobile(ua) {
  return /android|iphone|ipad|mobile/i.test(ua || '');
}

export default function UploadLogs() {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, errors, success
  const [expanded, setExpanded] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      let q = supabase
        .from('bubatrent_booking_upload_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter === 'errors') {
        q = q.in('step', ['error', 'timeout', 'network_error']);
      } else if (filter === 'success') {
        q = q.eq('step', 'success');
      }

      const { data, error } = await q;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch upload logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function clearOldLogs() {
    if (!window.confirm('Delete all upload logs older than 7 days?')) return;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('bubatrent_booking_upload_logs').delete().lt('created_at', cutoff);
    fetchLogs();
  }

  if (!isSuperAdmin) {
    return (
      <AdminLayout title="Upload Logs">
        <p className="text-red-400">Access denied. Super admin only.</p>
      </AdminLayout>
    );
  }

  if (loading) return <AdminLayout title="Upload Logs"><LoadingSpinner /></AdminLayout>;

  // Group logs by upload session (same user + booking within 2 min)
  const errorCount = logs.filter(l => ['error', 'timeout', 'network_error'].includes(l.step)).length;
  const successCount = logs.filter(l => l.step === 'success').length;

  return (
    <AdminLayout title="Upload Logs">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 text-sm">
          <span className="text-slate-400">Total:</span>
          <span className="text-white font-semibold">{logs.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-sm">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400 font-semibold">{errorCount} errors</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 text-sm">
          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400 font-semibold">{successCount} success</span>
        </div>

        <div className="flex-1" />

        {/* Filter */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'errors', label: 'Errors' },
            { value: 'success', label: 'Success' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.value ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setLoading(true); fetchLogs(); }}
          className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setAutoRefresh(p => !p)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            autoRefresh ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-slate-500'
          }`}
        >
          {autoRefresh ? '● Live' : '○ Paused'}
        </button>

        <button
          onClick={clearOldLogs}
          className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
          title="Clear logs older than 7 days"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Logs list */}
      {logs.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Upload className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No upload logs yet.</p>
          <p className="text-xs text-slate-600 mt-1">Logs will appear here when users upload files.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const cfg = STEP_CONFIG[log.step] || STEP_CONFIG.preflight;
            const Icon = cfg.icon;
            const meta = log.metadata || {};
            const mobile = isMobile(meta.browser);
            const isExpanded = expanded.has(log.id);

            return (
              <div
                key={log.id}
                className={`glass-card !p-3 cursor-pointer hover:bg-white/[0.03] transition-colors ${
                  ['error', 'timeout', 'network_error'].includes(log.step) ? 'border-red-500/20' : ''
                }`}
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {mobile ? (
                        <Smartphone className="w-3 h-3 text-amber-400" title="Mobile" />
                      ) : (
                        <Monitor className="w-3 h-3 text-slate-600" title="Desktop" />
                      )}
                      <span className="text-xs text-slate-500 truncate">{meta.file_name || ''}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 truncate">{log.message}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                      {meta.file_size ? `${(meta.file_size / 1024).toFixed(0)}KB` : ''}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-xs animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {meta.bucket && (
                        <div>
                          <span className="text-slate-500">Bucket:</span>{' '}
                          <span className="text-slate-300">{meta.bucket}</span>
                        </div>
                      )}
                      {meta.path && (
                        <div className="col-span-2">
                          <span className="text-slate-500">Path:</span>{' '}
                          <span className="text-slate-300 font-mono break-all">{meta.path}</span>
                        </div>
                      )}
                      {meta.file_type && (
                        <div>
                          <span className="text-slate-500">Type:</span>{' '}
                          <span className="text-slate-300">{meta.file_type}</span>
                        </div>
                      )}
                      {meta.httpStatus && (
                        <div>
                          <span className="text-slate-500">HTTP:</span>{' '}
                          <span className={meta.httpStatus >= 400 ? 'text-red-400' : 'text-green-400'}>{meta.httpStatus}</span>
                        </div>
                      )}
                      {log.booking_id && (
                        <div>
                          <span className="text-slate-500">Booking:</span>{' '}
                          <a href={`/admin/bookings/${log.booking_id}`} className="text-violet-400 hover:underline font-mono" onClick={e => e.stopPropagation()}>
                            {log.booking_id.substring(0, 8)}...
                          </a>
                        </div>
                      )}
                    </div>
                    {meta.response && (
                      <div>
                        <span className="text-slate-500">Response:</span>
                        <pre className="mt-1 p-2 rounded-lg bg-red-500/5 text-red-300 font-mono text-[11px] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                          {meta.response}
                        </pre>
                      </div>
                    )}
                    {meta.stack && (
                      <div>
                        <span className="text-slate-500">Stack:</span>
                        <pre className="mt-1 p-2 rounded-lg bg-red-500/5 text-red-300 font-mono text-[11px] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                          {meta.stack}
                        </pre>
                      </div>
                    )}
                    {meta.browser && (
                      <div>
                        <span className="text-slate-500">Browser:</span>{' '}
                        <span className="text-slate-400 break-all">{meta.browser}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
