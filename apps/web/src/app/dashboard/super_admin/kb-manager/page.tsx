import { redirect } from 'next/navigation';

/** Legacy URL — AI Learning Inbox lives at kb-questions. */
export default function KBManagerPage() {
  redirect('/dashboard/super_admin/kb-questions');
}
