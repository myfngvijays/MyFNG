'use client';

type ValidationPanelProps = {
  errors: string[];
  warnings: string[];
};

export default function ValidationPanel({ errors, warnings }: ValidationPanelProps) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Validation</h3>
      <div className="mt-2 space-y-2">
        <div>
          <p className="text-xs font-semibold text-red-600">Errors ({errors.length})</p>
          {errors.length === 0 ? (
            <p className="text-xs text-gray-500 mt-1">No errors.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {errors.map((item) => (
                <li key={item} className="text-xs text-red-700">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-600">Warnings ({warnings.length})</p>
          {warnings.length === 0 ? (
            <p className="text-xs text-gray-500 mt-1">No warnings.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {warnings.map((item) => (
                <li key={item} className="text-xs text-amber-700">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
