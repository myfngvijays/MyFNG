import { redirect } from 'next/navigation';

export default function LegacyNotificationsRedirect() {
  redirect('/dashboard/super_admin/advance-notifications?section=compose');
}
