'use client';

type Props = {
  planName: string;
  badge?: string;
  price: string;
  originalPrice?: string;
  benefitLine1: string;
  benefitLine2: string;
  animated?: boolean;
  membershipType?: 'SERVICE' | 'RSA';
};

export default function MembershipCardPreview({
  planName,
  badge = 'PRIME',
  price,
  originalPrice,
  benefitLine1,
  benefitLine2,
  animated = true,
  membershipType = 'SERVICE',
}: Props) {
  const isRsa = membershipType === 'RSA';
  const bg = isRsa
    ? 'linear-gradient(90deg, #DC2626 0%, #991B1B 50%, #DC2626 100%)'
    : animated
      ? 'linear-gradient(90deg, #004AAD 0%, #DC2626 50%, #004AAD 100%)'
      : '#004AAD';

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
      <div className="px-4 py-3 flex items-center justify-between text-white" style={{ background: bg }}>
        <div>
          <div className="text-[10px] font-bold tracking-wider opacity-90">{badge}</div>
          <div className="text-lg font-black leading-tight">{planName}</div>
        </div>
        <div className="text-right">
          {originalPrice ? <div className="text-xs line-through opacity-75">{originalPrice}</div> : null}
          <div className="text-xl font-black">{price}</div>
          <div className="text-[10px] opacity-80">per year</div>
        </div>
      </div>
      <div className="bg-white px-4 py-3 space-y-1">
        <div className="text-sm font-semibold text-gray-800">✓ {benefitLine1}</div>
        <div className="text-sm font-semibold text-gray-800">✓ {benefitLine2}</div>
      </div>
      <div className="px-4 pb-3">
        <div className="rounded-xl py-2.5 text-center text-white text-sm font-bold" style={{ background: isRsa ? '#DC2626' : '#004AAD' }}>
          Get {isRsa ? 'RSA' : 'Prime'} Membership →
        </div>
      </div>
    </div>
  );
}
