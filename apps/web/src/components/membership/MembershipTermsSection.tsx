'use client';

import React, { useEffect, useState } from 'react';

type Props = {
  membershipType?: 'RSA' | 'SERVICE';
  className?: string;
  dark?: boolean;
};

export default function MembershipTermsSection({ membershipType = 'RSA', className = '', dark = false }: Props) {
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch(`/api/public/membership-terms?type=${membershipType}&platform=web`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      setTerms(Array.isArray(json.terms) ? json.terms : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [membershipType]);

  if (loading) {
    return (
      <div className={`membership-terms-wrap ${className}`.trim()}>
        <p className={dark ? 'text-white/60 text-sm' : 'text-gray-500 text-sm'}>Loading terms…</p>
      </div>
    );
  }

  if (!terms.length) return null;

  return (
    <div className={`membership-terms-wrap ${className}`.trim()}>
      <ul className={`membership-terms-list ${dark ? 'membership-terms-list-dark' : ''}`.trim()}>
        {terms.map((term) => (
          <li key={term}>
            <span className={dark ? 'membership-terms-check' : 'tick'} aria-hidden>
              ✓
            </span>
            <span>{term}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
