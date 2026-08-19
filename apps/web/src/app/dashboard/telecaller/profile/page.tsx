import { redirect } from 'next/navigation';

/** Old multi-step profile URL — My Profile + attendance live on /me */
export default function TelecallerProfileRedirect() {
  redirect('/dashboard/telecaller/me');
}
