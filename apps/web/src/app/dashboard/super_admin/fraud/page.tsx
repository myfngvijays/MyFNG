import { redirect } from 'next/navigation';

export default function FraudRedirectPage() {
  redirect('/dashboard/super_admin/system-monitor?tab=fraud');
}
