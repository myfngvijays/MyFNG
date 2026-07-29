import { redirect } from 'next/navigation';

/** Legacy mock analytics — superseded by Analytics Hub. */
export default function SuperAdminAnalyticsPage() {
  redirect('/dashboard/super_admin/analytics-hub?section=overview');
}
