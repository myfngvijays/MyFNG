import { redirect } from 'next/navigation';

export default function AuditLogsRedirectPage() {
  redirect('/dashboard/super_admin/system-monitor?tab=audit');
}
