'use client';

import { Copy, Save, Send, ZoomIn, ZoomOut, Maximize2, Lock, Unlock } from 'lucide-react';

type FlowToolbarProps = {
  loading?: boolean;
  dirty?: boolean;
  locked?: boolean;
  onToggleLock: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onClone: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
};

export default function FlowToolbar({
  loading,
  dirty,
  locked,
  onToggleLock,
  onSaveDraft,
  onPublish,
  onClone,
  onZoomIn,
  onZoomOut,
  onFitView,
}: FlowToolbarProps) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          Save Draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          Publish
        </button>
        <button
          type="button"
          onClick={onClone}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <Copy className="h-3.5 w-3.5" />
          Clone
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <button
          type="button"
          onClick={onZoomOut}
          className="rounded-lg border p-1.5 text-gray-700 hover:bg-gray-50"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded-lg border p-1.5 text-gray-700 hover:bg-gray-50"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onFitView}
          className="rounded-lg border p-1.5 text-gray-700 hover:bg-gray-50"
          aria-label="Fit view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          className="rounded-lg border p-1.5 text-gray-700 hover:bg-gray-50"
          aria-label="Toggle lock mode"
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>

        <span className="ml-auto text-xs font-medium text-gray-500">
          {loading ? 'Working...' : dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
      </div>
    </div>
  );
}
