import { redirect } from 'next/navigation';

export default function DataRightsRedirectPage() {
  redirect('/dashboard/super_admin/compliance-reports?section=rights');
}
