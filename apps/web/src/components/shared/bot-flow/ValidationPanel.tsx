'use client';

type ValidationPanelProps = {
  errors: string[];
  warnings: string[];
};

export default function ValidationPanel({ errors, warnings }: ValidationPanelProps) {
  const ok = errors.length === 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Validation</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {ok ? 'Ready' : `${errors.length} error${errors.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {errors.length > 0 ? (
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
          {errors.map((item) => (
            <li key={item} className="text-[11px] leading-snug text-rose-700">
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No blocking errors.</p>
      )}
      {warnings.length > 0 ? (
        <ul className="mt-2 max-h-20 space-y-1 overflow-y-auto border-t border-slate-200 pt-2">
          {warnings.map((item) => (
            <li key={item} className="text-[11px] leading-snug text-amber-700">
              • {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
