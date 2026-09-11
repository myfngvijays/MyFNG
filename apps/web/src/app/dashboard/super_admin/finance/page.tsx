import { redirect } from 'next/navigation';

export default function FinanceRedirectPage() {
  redirect('/dashboard/super_admin');
}
