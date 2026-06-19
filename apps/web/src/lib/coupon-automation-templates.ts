export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  trigger_type: string;
  action_type: string;
  conditions: Record<string, unknown>;
  icon: string;
  category: 'onboarding' | 'retention' | 'geo' | 'lifecycle';
};

export const COUPON_AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: 'welcome_signup',
    name: 'Welcome New Customer',
    description: 'Auto-assign a welcome coupon when a customer registers on app or web.',
    trigger_type: 'NEW_SIGNUP',
    action_type: 'ASSIGN_COUPON',
    conditions: { channels: ['WEB', 'MOBILE'] },
    icon: '👋',
    category: 'onboarding',
  },
  {
    key: 'first_order',
    name: 'First Order Discount',
    description: 'Apply or assign coupon automatically on customer\'s first service booking.',
    trigger_type: 'FIRST_ORDER',
    action_type: 'AUTO_APPLY',
    conditions: { channels: ['ALL'], first_order_only: true },
    icon: '🎉',
    category: 'onboarding',
  },
  {
    key: 'lead_created',
    name: 'Telecaller Lead Coupon',
    description: 'Assign coupon when telecaller creates a lead with eligible segment.',
    trigger_type: 'LEAD_CREATED',
    action_type: 'ASSIGN_COUPON',
    conditions: { channels: ['TELECALLER'] },
    icon: '📞',
    category: 'lifecycle',
  },
  {
    key: 'inactive_30d',
    name: 'Win-back (30 days inactive)',
    description: 'Re-engage customers who have not booked in the last 30 days.',
    trigger_type: 'INACTIVE_DAYS',
    action_type: 'ASSIGN_COUPON',
    conditions: { inactive_days: 30 },
    icon: '🔁',
    category: 'retention',
  },
  {
    key: 'birthday',
    name: 'Birthday Offer',
    description: 'Send birthday coupon to customers on their birthday week.',
    trigger_type: 'BIRTHDAY',
    action_type: 'NOTIFY_CUSTOMER',
    conditions: { days_before: 0 },
    icon: '🎂',
    category: 'lifecycle',
  },
  {
    key: 'city_launch',
    name: 'City Launch Promo',
    description: 'Auto-apply city-specific coupon for customers in selected cities.',
    trigger_type: 'CHECKOUT_APPLY',
    action_type: 'AUTO_APPLY',
    conditions: { city_ids: [], channels: ['WEB', 'MOBILE'] },
    icon: '🏙️',
    category: 'geo',
  },
  {
    key: 'membership_renewal',
    name: 'Membership Renewal',
    description: 'Assign renewal coupon when membership is about to expire.',
    trigger_type: 'MEMBERSHIP_RENEWAL',
    action_type: 'ASSIGN_COUPON',
    conditions: { days_before_expiry: 7 },
    icon: '⭐',
    category: 'retention',
  },
  {
    key: 'high_value_cart',
    name: 'High Value Cart',
    description: 'Auto-apply coupon when cart subtotal crosses a threshold.',
    trigger_type: 'CHECKOUT_APPLY',
    action_type: 'AUTO_APPLY',
    conditions: { min_order_value: 2000, channels: ['WEB', 'MOBILE'] },
    icon: '💰',
    category: 'lifecycle',
  },
];

export const TRIGGER_LABELS: Record<string, string> = {
  NEW_SIGNUP: 'New customer signup',
  FIRST_ORDER: 'First order placed',
  LEAD_CREATED: 'Lead created',
  INACTIVE_DAYS: 'Customer inactive',
  BIRTHDAY: 'Customer birthday',
  CHECKOUT_APPLY: 'Checkout / cart apply',
  MEMBERSHIP_RENEWAL: 'Membership renewal',
  MANUAL: 'Manual trigger',
};

export const ACTION_LABELS: Record<string, string> = {
  ASSIGN_COUPON: 'Assign coupon to customer',
  AUTO_APPLY: 'Auto-apply at checkout',
  NOTIFY_CUSTOMER: 'Notify customer (SMS/Push)',
};

export function formatAutomationConditions(conditions: Record<string, unknown>) {
  const parts: string[] = [];
  const channels = conditions.channels;
  if (Array.isArray(channels) && channels.length && !channels.includes('ALL')) {
    parts.push(`Channels: ${channels.join(', ')}`);
  }
  if (conditions.inactive_days) parts.push(`Inactive ${conditions.inactive_days}+ days`);
  if (conditions.min_order_value) parts.push(`Min order ₹${conditions.min_order_value}`);
  if (conditions.days_before_expiry) parts.push(`${conditions.days_before_expiry} days before expiry`);
  if (conditions.days_before != null) parts.push(`Birthday window`);
  if (Array.isArray(conditions.city_ids) && conditions.city_ids.length) {
    parts.push(`${conditions.city_ids.length} cities`);
  }
  if (conditions.first_order_only) parts.push('First order only');
  return parts.length ? parts.join(' · ') : 'No extra conditions';
}
