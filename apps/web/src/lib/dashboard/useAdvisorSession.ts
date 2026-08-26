'use client';

import { useAuthStore } from '@/store/authStore';

/** Workshop id + user from the already-loaded dashboard session (no extra auth round-trip). */
export function useAdvisorSession() {
  const userProfile = useAuthStore((s) => s.userProfile);
  return {
    workshopId: (userProfile?.workshop_id as string | undefined) || null,
    userId: (userProfile?.id as string | undefined) || null,
    email: (userProfile?.email as string | undefined) || null,
    profile: userProfile,
    ready: !!userProfile,
  };
}
