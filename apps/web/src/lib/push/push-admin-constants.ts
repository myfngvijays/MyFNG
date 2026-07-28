export const PUSH_ROLE_OPTIONS = [
  { value: 'ALL', label: 'All Users', description: 'Customers + staff with registered devices' },
  { value: 'CUSTOMER', label: 'Customers', description: 'MyFNG mobile app customers' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Super admin users' },
  { value: 'SUB_ADMIN', label: 'Sub Admin', description: 'Sub admin users' },
  { value: 'TELECALLER', label: 'Telecaller', description: 'Telecaller agents' },
  { value: 'WORKSHOP_ADMIN', label: 'Workshop Owner', description: 'Workshop owners/admins' },
  { value: 'WORKSHOP_SUPERVISOR', label: 'Workshop Adviser', description: 'Workshop advisers' },
  { value: 'WORKSHOP_MECHANIC', label: 'Workshop Mechanic', description: 'Workshop mechanics' },
  { value: 'WORKSHOP_PICKUP_BOY', label: 'Pickup Boy', description: 'Pickup/delivery drivers' },
  { value: 'LEAD_MANAGER', label: 'Lead Manager', description: 'Lead managers' },
] as const;

export const PUSH_TEST_PHONE_PRESETS = [
  { phone: '8652710389', label: 'Nikhil Y' },
  { phone: '9594294017', label: 'Yunick' },
  { phone: '9175750091', label: 'Shekhar' },
  { phone: '9619945926', label: 'Test User' },
] as const;

export type PushLogEntry = {
  id: string;
  recipient: string;
  message: string;
  status: string;
  sent_at: string;
  meta?: {
    title?: string;
    body?: string;
    target_role?: string;
    target_phone?: string | null;
    sent_by?: string;
    devices?: number;
    devices_attempted?: number;
    fcm_errors?: string[];
    priority?: string;
  };
};

/** Used when DB migration 219 is not applied yet */
export const PUSH_FALLBACK_TEMPLATES = [
  {
    id: 'fallback-welcome',
    name: 'Welcome Bonus',
    title: '₹1000 Welcome Bonus Credited!',
    body: 'Your welcome bonus is in your MyFNG wallet. Book your first service today and save more.',
    target_role: 'CUSTOMER',
    priority: 'high',
    category: 'onboarding',
  },
  {
    id: 'fallback-diwali',
    name: 'Diwali Service Sale',
    title: 'Diwali Mega Service Sale 🪔',
    body: 'Flat 20% off on periodic service + free pickup & drop. Book before slots fill up!',
    target_role: 'CUSTOMER',
    priority: 'default',
    category: 'promotion',
  },
  {
    id: 'fallback-reminder',
    name: 'Service Due Reminder',
    title: 'Time for Your Car Service',
    body: 'Your car service is due soon. Schedule pickup in 2 taps — same-day slots available.',
    target_role: 'CUSTOMER',
    priority: 'default',
    category: 'reminder',
  },
  {
    id: 'fallback-welcome-expiry-d15',
    name: 'Welcome Bonus Expiry D15',
    title: '₹{{amount}} Welcome Bonus — 15 days left',
    body: 'Your MyFNG welcome bonus expires in 15 days. Book a service and use it before it expires.',
    target_role: 'CUSTOMER',
    priority: 'high',
    category: 'automation',
  },
  {
    id: 'fallback-welcome-expiry-daily',
    name: 'Welcome Bonus Expiry Daily',
    title: '₹{{amount}} Welcome Bonus — {{days_left}} days left',
    body: 'Hurry! Your welcome bonus expires in {{days_left}} days. Book now and save.',
    target_role: 'CUSTOMER',
    priority: 'high',
    category: 'automation',
  },
] as const;
