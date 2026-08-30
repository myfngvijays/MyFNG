'use client';

import WorkshopStaffProfilePage from '@/components/workshop/WorkshopStaffProfilePage';

export default function WorkshopOwnerProfilePage() {
  return <WorkshopStaffProfilePage layoutRole="workshop_admin" roleFallback="Workshop Owner" />;
}
