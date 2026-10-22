import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { CHANGELOG, LATEST_CHANGE } from '../../data/changelog';
import { formatDate } from '../../utils/dates';
import { markChangesSeen } from '../../utils/changelogSeen';

const KINDS = {
  new: { label: 'New', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/25' },
  improved: { label: 'Improved', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  fixed: { label: 'Fixed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  rule: { label: 'How it works now', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  data: { label: 'Prices & cars', cls: 'bg-white/5 text-slate-300 border-white/10' },
};

export default function WhatsNew() {
  // Opening the page clears the dot in the menu
  useEffect(() => {
    markChangesSeen(LATEST_CHANGE);
  }, []);

  return (
    <AdminLayout title="What's New">
      <p className="text-sm text-slate-400 mb-6">
        Every update to rent2go.my, newest first. For how something works, see the{' '}
        <Link to="/admin/manual" className="text-violet-400 hover:underline">
          User Manual
        </Link>
        .
      </p>
      <div className="space-y-6">
        {CHANGELOG.map((day) => (
          <section key={day.date}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {formatDate(day.date)}
            </h2>
            <div className="glass-card !p-0 divide-y divide-white/5">
              {day.items.map((item) => {
                const kind = KINDS[item.kind] || KINDS.improved;
                const body = (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${kind.cls}`}
                        >
                          {kind.label}
                        </span>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{item.text}</p>
                    </div>
                    {item.link && <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                  </>
                );
                return item.link ? (
                  <Link
                    key={item.title}
                    to={item.link}
                    className="flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={item.title} className="flex items-center gap-3 p-4">
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminLayout>
  );
}
