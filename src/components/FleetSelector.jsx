import { useFleet } from '../hooks/useFleet';
import { ChevronDown, Building2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function FleetSelector() {
  const { fleets, activeFleetId, setActiveFleetId, activeFleet } = useFleet();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (fleets.length <= 1) {
    // Single fleet — just show name
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
        <Building2 className="w-4 h-4 text-violet-400" />
        <span className="text-sm text-white font-medium truncate max-w-[180px]">
          {activeFleet?.name || 'No Fleet'}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Building2 className="w-4 h-4 text-violet-400" />
        <span className="text-sm text-white font-medium truncate max-w-[180px]">
          {activeFleet?.name || 'Select Fleet'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 glass-card !p-1 z-50 animate-fade-in border border-white/10">
          {fleets.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFleetId(f.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                f.id === activeFleetId
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
