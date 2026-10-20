import type { Metadata } from 'next';
import StatusBoard from '@/components/status/StatusBoard';

export const metadata: Metadata = {
  title: 'System Status',
  description: 'Live status of the MyFNG website, app, login, payments, WhatsApp alerts, and pickup updates.',
};

export default function StatusPage() {
  return <StatusBoard />;
}
