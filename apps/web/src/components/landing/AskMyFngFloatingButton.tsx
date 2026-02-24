'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';

export default function AskMyFngFloatingButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Hide widget on the dedicated full-page chat route.
  if (pathname === '/ai-booking') return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[80] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl md:bottom-6">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-100 p-1.5">
                <MessageSquare className="h-4 w-4 text-blue-700" />
              </div>
              <div className="text-sm font-semibold text-gray-900">Ask MyFNG</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe
            src="/ai-booking?embed=1"
            className="h-[560px] w-full border-0"
            title="MyFNG Chatbot"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 right-4 z-[70] inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 md:bottom-6"
        aria-label="Ask MyFNG"
      >
        <MessageSquare className="h-4 w-4" />
        <span>Ask MyFNG</span>
      </button>
    </>
  );
}
