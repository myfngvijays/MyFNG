function displayChecklistName(name: string) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (n.includes('power steering') && n.includes('clutch oil')) {
    return 'Steering / Clutch Oil Top-up';
  }
  return name;
}

/** Highlight the word "Replace" in checklist point names. */
export default function ChecklistPointLabel({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const parts = displayChecklistName(String(name || '')).split(/(replace)/gi);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /^replace$/i.test(part) ? (
          <span key={i} className="font-semibold text-red-600">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
