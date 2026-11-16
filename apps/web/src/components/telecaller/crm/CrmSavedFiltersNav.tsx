'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlidersHorizontal, Trash2 } from 'lucide-react';

type Row = { id: string; name: string; owner_id: string };

export default function CrmSavedFiltersNav({
  leadsHref,
  collapsed,
}: {
  leadsHref: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState('');
  const [views, setViews] = useState<Row[]>([]);
  const [me, setMe] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/lead-manager/saved-views', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      const rows = (Array.isArray(json?.views) ? json.views : [])
        .filter((row: any) => row?.filters?.kind === 'crm_leads')
        .map((row: any) => ({
          id: String(row.id),
          name: String(row.name || 'View'),
          owner_id: String(row.owner_id || ''),
        }));
      setViews(rows);
      setMe(String(json?.me || ''));
    } catch {
      setViews([]);
    }
  }, []);

  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get('view') || '';
      setActiveId(id);
    };
    read();
    void load();
    const onChange = () => {
      read();
      void load();
    };
    window.addEventListener('myfng:crm-views-changed', onChange);
    window.addEventListener('popstate', read);
    return () => {
      window.removeEventListener('myfng:crm-views-changed', onChange);
      window.removeEventListener('popstate', read);
    };
  }, [load, pathname]);

  const remove = async (id: string) => {
    await fetch(`/api/lead-manager/saved-views?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setViews((prev) => prev.filter((row) => row.id !== id));
    window.dispatchEvent(new CustomEvent('myfng:crm-views-changed'));
  };

  const childOn = views.some((row) => row.id === activeId);

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg text-sm sm:text-base ${
          childOn ? 'bg-white/15 text-white font-semibold' : 'text-white/90 font-medium'
        } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
        title={collapsed ? 'Filters' : undefined}
      >
        <span className="flex-shrink-0">
          <SlidersHorizontal className="h-5 w-5" />
        </span>
        <span className={`${collapsed ? 'lg:hidden' : ''} min-w-0 leading-snug break-words`}>Filters</span>
      </div>
      <div className={`${collapsed ? 'lg:hidden' : ''} ml-8 space-y-0.5`}>
        {views.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-white/50">Save a view</p>
        ) : (
          views.map((row) => {
            const on = activeId === row.id;
            return (
              <div key={row.id} className="group flex items-center">
                <Link
                  href={`${leadsHref}?view=${encodeURIComponent(row.id)}`}
                  title={row.name}
                  className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-[12px] leading-tight ${
                    on ? 'bg-white/20 font-semibold text-white' : 'font-medium text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {row.name}
                </Link>
                {row.owner_id === me ? (
                  <button
                    type="button"
                    className="mr-1 hidden rounded p-1 text-white/60 hover:bg-white/10 hover:text-white group-hover:inline-flex"
                    title="Delete"
                    onClick={() => void remove(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
