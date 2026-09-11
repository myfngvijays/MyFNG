import { redirect } from 'next/navigation';

export default function SecurityEventsRedirectPage() {
  redirect('/dashboard/super_admin/system-monitor?tab=security');
}
