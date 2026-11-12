'use client';

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export default function RemovableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {label ? (
            <span className="rounded bg-white px-1 text-[10px] font-medium text-slate-600 shadow-sm">{String(label)}</span>
          ) : null}
          <button
            type="button"
            title="Remove wire"
            className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] leading-none text-slate-500 shadow-sm hover:border-rose-300 hover:text-rose-600"
            onClick={(event) => {
              event.stopPropagation();
              window.dispatchEvent(new CustomEvent('bot-flow-remove-edge', { detail: { id } }));
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
