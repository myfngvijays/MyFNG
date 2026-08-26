import { redirect } from 'next/navigation';

export default function LeadManagerDialerRedirect() {
  redirect('/dashboard/lead_manager/leads');
}
