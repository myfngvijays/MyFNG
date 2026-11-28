'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Folder } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';

export default function CallRecordingPage() {
  const pathname = usePathname();
  const { layoutRole } = getCrmDashboardBase(pathname);
  const [folder, setFolder] = useState('');
  const [pathDraft, setPathDraft] = useState('Recordings/Call');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/telecaller/profile/recording-path');
      const data = await res.json();
      const label = String(data?.path?.label || '');
      const uri = String(data?.path?.uri || '');
      if (res.ok && label && !label.startsWith('content://')) {
        setFolder(label);
      } else if (uri.startsWith('fs:')) {
        setFolder(label || uri.slice(3));
      } else {
        setFolder('');
      }
      if (uri.startsWith('fs:')) {
        setPathDraft(uri.slice(3).replace(/^\/storage\/emulated\/0\/?/, '') || 'Recordings/Call');
      }
    } catch {
      setFolder('');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const savePath = async () => {
    const trimmed = pathDraft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const uri = trimmed.startsWith('/')
        ? `fs:${trimmed}`
        : `fs:/storage/emulated/0/${trimmed.replace(/^\/+/, '')}`;
      const label = trimmed.includes('/')
        ? `Internal storage / ${trimmed.split('/').join(' / ')}`
        : `Internal storage / ${trimmed}`;
      const res = await fetch('/api/telecaller/profile/recording-path', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, label, auto_since: Date.now() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setFolder(label);
      setToast('Path saved — phone par SYNC chalega jab same profile login ho');
      await load();
    } catch {
      setToast('Could not save path');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-extrabold" style={{ color: '#0F172A' }}>
          Call Recording
        </h1>
        <section className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <p className="px-4 pt-4 text-lg font-extrabold" style={{ color: '#0F172A' }}>
            Recording&apos;s Folder
          </p>
          <div className="flex flex-col items-center px-4 py-6">
            <Folder className="h-14 w-14 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-500">{folder || 'No folder selected'}</p>
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
            Samsung: Google Drive mat chunein — phone par <strong>My Files → Recordings → Call</strong>, ya neeche path
            save karein.
          </p>

          <div className="border-t border-slate-100 px-4 py-4">
            <p className="text-sm font-bold text-slate-800">Path save (phone par sync ke liye)</p>
            <p className="mt-1 text-xs text-slate-500">
              Jahan call recordings save hoti hain — jaise <span className="font-mono">Recordings/Call</span>
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                value={pathDraft}
                onChange={(e) => setPathDraft(e.target.value)}
                placeholder="Recordings/Call"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void savePath()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save path'}
              </button>
            </div>
          </div>

          <p className="border-t border-slate-100 px-4 py-3 text-sm font-semibold text-violet-600">
            Phone app: <strong>Select folder</strong> (My Files) ya <strong>Save path</strong> — dono chalte hain
          </p>
        </section>
        {toast ? (
          <p className="mt-3 text-center text-sm font-semibold text-emerald-700">{toast}</p>
        ) : (
          <p className="mt-3 text-center text-sm text-slate-500">
            Select folder aur Sync phone app (Call Recording) par hain.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}