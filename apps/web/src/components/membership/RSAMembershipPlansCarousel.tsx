'use client';

import React, { useEffect, useState } from 'react';
import MembershipValueCard from '@/components/membership/MembershipValueCard';
import { fetchPublicMembershipPlans, type PublicMembershipPlan } from '@/lib/public-membership-plan';
import { isPlacementEnabled, type RsaPlacementSlot } from '@/lib/membership-placements';

type Props = {
  slot?: RsaPlacementSlot;
  className?: string;
};

export default function RSAMembershipPlansCarousel({ slot, className = '' }: Props) {
  const [plans, setPlans] = useState<PublicMembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = 'flaticon-uicons-rsa-plans';
    if (typeof document !== 'undefined' && !document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://cdn-uicons.flaticon.com/uicons-regular-rounded/css/uicons-regular-rounded.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const rows = await fetchPublicMembershipPlans();
      if (!active) return;
      const rsaPlans = rows
        .filter((p) => p.membershipType === 'RSA')
        .filter((p) => p.webVisible !== false)
        .filter((p) => (slot ? isPlacementEnabled(p.appPlacements, `rsa.${slot}`) : true));
      setPlans(rsaPlans);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slot]);

  if (loading) {
    return (
      <div className={`rsa-plans-wrap ${className}`.trim()}>
        <div className="rsa-plans-loading">Loading membership plans…</div>
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div className={`rsa-plans-wrap ${className}`.trim()}>
      <div className="section-title rsa-plans-copy">
        <div>
          <h2>Best Plans for You</h2>
          <p>Subscription packages which suit your car and your pocket.</p>
        </div>
      </div>

      <div className="rsa-plans-grid">
        {plans.map((plan) => (
          <div key={plan.planId} className="rsa-plans-card">
            <MembershipValueCard plan={plan} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
