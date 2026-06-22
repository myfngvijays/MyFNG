export type PrimeValueBenefit = {
  benefitCode?: string;
  showClaimButton?: boolean;
  icon: string;
  title: string;
  description: string;
  valueLabel: string;
  valuePrefix?: string;
};

export const PRIME_VALUE_BENEFITS: PrimeValueBenefit[] = [
  {
    benefitCode: 'PERIODIC_10_OFF',
    showClaimButton: true,
    icon: 'pricetag',
    title: '10% Off Periodic Packages',
    description: 'On every scheduled service, all year',
    valuePrefix: 'Up to',
    valueLabel: '₹1,000',
  },
  {
    benefitCode: 'CASHBACK_5',
    icon: 'cash',
    title: '5% Cashback to Wallet',
    description: 'On every bill, all year, auto-credited',
    valueLabel: '₹500',
  },
  {
    benefitCode: 'FREE_INSPECTION',
    showClaimButton: true,
    icon: 'construct',
    title: 'Free Top-Up & Inspection (2x)',
    description: 'Fluids, tyre pressure, visual check',
    valueLabel: '₹1,200',
  },
  {
    benefitCode: 'FREE_SCAN',
    showClaimButton: true,
    icon: 'pulse',
    title: 'Free Car Scanning (2x)',
    description: 'Full computerised diagnostic',
    valueLabel: '₹1,200',
  },
  {
    benefitCode: 'DAMAGE_ASSESS',
    showClaimButton: true,
    icon: 'shield-checkmark',
    title: 'Free Insurance Claim Help',
    description: 'We assess, document & handle your claim',
    valueLabel: '₹1,000',
  },
  {
    benefitCode: 'WHATSAPP_GROUP',
    icon: 'logo-whatsapp',
    title: 'Prime Personal WhatsApp Group',
    description: 'Senior technical advisor for all your car needs',
    valueLabel: '₹500',
  },
  {
    benefitCode: 'PRIORITY_BOOKING',
    icon: 'flash',
    title: 'Priority Slot Booking',
    description: 'First pick on every slot, skip the wait',
    valueLabel: '₹500',
  },
  {
    benefitCode: 'EXTENDED_WARRANTY',
    icon: 'ribbon',
    title: '6-Month Extended Warranty',
    description: '6x our standard coverage on every service',
    valueLabel: '₹500',
  },
];

export const PRIME_VALUE_TOTAL = 6650;
export const PRIME_VALUE_PRICE = 699;
export const PRIME_VALUE_SAVE = PRIME_VALUE_TOTAL - PRIME_VALUE_PRICE;
export const PRIME_VALUE_ADDON = 299;

export const PRIME_VALUE_FOOTER =
  'Valid 12 months from activation · Linked to registered mobile number · Free pickup & drop included as standard';
