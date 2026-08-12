'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Form/list left + preview right. Uses matchMedia so admin sidebar
 * width cannot break Tailwind md/lg grid stacking.
 */
export default function SplitWithPreview({
  main,
  preview,
  previewWidth = 320,
}: {
  main: ReactNode;
  preview: ReactNode;
  previewWidth?: number;
}) {
  const [sideBySide, setSideBySide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const apply = () => setSideBySide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div
      style={
        sideBySide
          ? {
              display: 'grid',
              gridTemplateColumns: `minmax(0, 1fr) ${previewWidth}px`,
              gap: '1.25rem',
              alignItems: 'start',
              width: '100%',
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              width: '100%',
            }
      }
    >
      <div style={{ minWidth: 0, width: '100%' }}>{main}</div>
      <div
        style={
          sideBySide
            ? { width: previewWidth, maxWidth: '100%', position: 'sticky', top: 16, alignSelf: 'start' }
            : { width: '100%' }
        }
      >
        {preview}
      </div>
    </div>
  );
}
