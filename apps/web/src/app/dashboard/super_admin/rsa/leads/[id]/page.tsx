import { RSALeadDetailPageView } from '@/app/dashboard/rsa_manager/leads/[id]/page';

export default function SuperAdminRSALeadDetailPage() {
  // Super Admin dashboard already provides its own sidebar/layout via `app/dashboard/super_admin/layout.tsx`.
  // Render the shared lead detail view *without* `DashboardLayout` to avoid nested/wrong sidebars.
  return <RSALeadDetailPageView embedded />;
}
