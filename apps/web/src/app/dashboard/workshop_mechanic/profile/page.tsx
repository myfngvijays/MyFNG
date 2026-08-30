'use client';

import WorkshopStaffProfilePage from '@/components/workshop/WorkshopStaffProfilePage';

export default function MechanicProfilePage() {
  return (
    <WorkshopStaffProfilePage
      layoutRole="workshop_mechanic"
      roleFallback="Workshop Mechanic"
    />
  );
}
