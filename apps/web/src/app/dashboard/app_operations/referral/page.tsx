import ReferAndRiseApp from '@/components/admin/referral/ReferAndRiseApp';

/** Same new Refer & Rise UI as Super Admin (view-only — API blocks edits for App Ops). */
export default function AppOperationsReferralPage() {
  return <ReferAndRiseApp mode="full" />;
}
