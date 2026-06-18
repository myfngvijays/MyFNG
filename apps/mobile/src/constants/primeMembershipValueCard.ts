export type PrimeValueBenefit = {
  icon: string;
  title: string;
  description: string;
  valueLabel: string;
  valuePrefix?: string;
};

export const PRIME_VALUE_BENEFITS: PrimeValueBenefit[] = [
  {
    icon: 'pricetag',
    title: '10% Off Periodic Packages',
    description: 'On every scheduled service, all year',
    valuePrefix: 'Up to',
    valueLabel: '₹1,000',
  },
  {
    icon: 'cash',
    title: '5% Cashback to Wallet',
    description: 'On every bill, all year, auto-credited',
    valueLabel: '₹500',
  },
  {
    icon: 'construct',
    title: 'Free Top-Up & Inspection (2x)',
    description: 'Fluids, tyre pressure, visual check',
    valueLabel: '₹1,200',
  },
  {
    icon: 'pulse',
    title: 'Free Car Scanning (2x)',
    description: 'Full computerised diagnostic',
    valueLabel: '₹1,200',
  },
  {
    icon: 'shield-checkmark',
    title: 'Free Insurance Claim Help',
    description: 'We assess, document & handle your claim',
    valueLabel: '₹1,000',
  },
  {
    icon: 'logo-whatsapp',
    title: 'Prime Personal WhatsApp Group',
    description: 'Senior technical advisor for all your car needs',
    valueLabel: '₹500',
  },
  {
    icon: 'flash',
    title: 'Priority Slot Booking',
    description: 'First pick on every slot, skip the wait',
    valueLabel: '₹500',
  },
  {
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
