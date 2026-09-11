/** Highlight the word "Replace" in checklist point names. */
export default function ChecklistPointLabel({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const parts = String(name || '').split(/(replace)/gi);
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
