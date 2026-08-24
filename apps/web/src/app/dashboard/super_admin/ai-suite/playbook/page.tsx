'use client';

import SalesPlaybookPanel from '@/components/admin/SalesPlaybookPanel';

export default function SuperAdminPlaybookPage() {
  return (
    <SalesPlaybookPanel
      helpHref="/dashboard/super_admin/ai-suite/playbook"
      suiteHref="/dashboard/super_admin/ai-suite"
    />
  );
}
