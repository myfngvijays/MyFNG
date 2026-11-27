'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_CALLER_PERMISSIONS,
  FULL_MANAGER_PERMISSIONS,
  normalizeCrmPermissions,
  type CrmPermissions,
} from '@/lib/telecaller/crmPermissions';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { usePathname } from 'next/navigation';

/** `enabled: false` skips the fetch (e.g. layout for non-telecaller roles). */
export function useCrmPermissions(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const pathname = usePathname();
  const { isLeadManager: onManagerPath } = getCrmDashboardBase(pathname);
  const isLeadManager = onManagerPath || !enabled;
  const [permissions, setPermissions] = useState<CrmPermissions>(
    isLeadManager ? FULL_MANAGER_PERMISSIONS : DEFAULT_CALLER_PERMISSIONS,
  );
  const [loading, setLoading] = useState(!isLeadManager);
  const [templateName, setTemplateName] = useState<string | null>(null);

  useEffect(() => {
    if (isLeadManager) {
      setPermissions(FULL_MANAGER_PERMISSIONS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { crmFetch } = await import('@/lib/telecaller/crmFetch');
        const res = await crmFetch('/api/telecaller/crm/permissions');
        const json = await res.json();
        if (!cancelled && res.ok && json?.permissions) {
          setPermissions(normalizeCrmPermissions(json.permissions));
          setTemplateName(json.templateName || null);
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLeadManager]);

  return { permissions, loading, templateName, isLeadManager };
}
