'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ZonePricesPage from '../../super_admin/inventory/zone-prices/page';

export default function TelecallerZonePricesPage() {
  return (
    <DashboardLayout role="telecaller">
      <ZonePricesPage />
    </DashboardLayout>
  );
}
