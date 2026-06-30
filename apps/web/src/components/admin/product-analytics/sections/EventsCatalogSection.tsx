'use client';

import { useState } from 'react';
import { Search, Filter, Smartphone, Globe, Bell, Zap, ShoppingCart, User, MapPin, MessageSquare, Car, Gauge, Calculator, Gamepad2 } from 'lucide-react';

type EventEntry = {
  name: string;
  params: string;
  description: string;
};

type EventCategory = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  file: string;
  events: EventEntry[];
};

const EVENT_CATALOG: EventCategory[] = [
  {
    id: 'booking',
    label: 'Booking Flow',
    icon: ShoppingCart,
    color: '#7c3aed',
    file: 'PublicBookServiceNowScreen.tsx',
    events: [
      { name: 'booking_started', params: '—', description: 'User opened booking flow' },
      { name: 'booking_step_viewed', params: '{ step }', description: 'User navigated to a step' },
      { name: 'booking_city_detected', params: '—', description: 'City auto-detected from location' },
      { name: 'booking_service_selected', params: '—', description: 'User selected a service' },
      { name: 'booking_date_selected', params: '—', description: 'User picked a date' },
      { name: 'booking_car_model_selected', params: '—', description: 'User selected car model' },
      { name: 'booking_pickup_mode_selected', params: '{ mode }', description: 'Pickup or workshop visit chosen' },
      { name: 'booking_time_selected', params: '—', description: 'User picked a time slot' },
      { name: 'booking_payment_method_selected', params: '{ method }', description: 'PAY_NOW or PAY_LATER' },
      { name: 'booking_wallet_toggle', params: '{ enabled }', description: 'Wallet usage toggled' },
      { name: 'booking_coupon_applied', params: '—', description: 'Coupon applied successfully' },
      { name: 'booking_coupon_failed', params: '—', description: 'Coupon application failed' },
      { name: 'booking_submitted', params: '—', description: 'Booking submitted (conversion)' },
      { name: 'booking_submit_failed', params: '—', description: 'Booking submission error' },
      { name: 'payment_initiated', params: '—', description: 'Razorpay payment started' },
      { name: 'payment_success', params: '—', description: 'Payment completed (conversion)' },
      { name: 'payment_cancelled', params: '—', description: 'User cancelled payment' },
      { name: 'payment_failed', params: '—', description: 'Payment failed' },
    ],
  },
  {
    id: 'auth',
    label: 'Authentication',
    icon: User,
    color: '#059669',
    file: 'CustomerOtpLoginScreen.tsx',
    events: [
      { name: 'otp_sent', params: '{ method }', description: 'OTP sent via WhatsApp or SMS' },
      { name: 'otp_send_failed', params: '—', description: 'OTP send failed' },
      { name: 'otp_verified', params: '—', description: 'OTP verification successful' },
      { name: 'otp_verify_failed', params: '—', description: 'OTP verification failed' },
      { name: 'otp_resend_tapped', params: '—', description: 'User tapped resend OTP' },
    ],
  },
  {
    id: 'signup',
    label: 'Sign Up',
    icon: User,
    color: '#0891b2',
    file: 'CustomerRegistrationScreen.tsx',
    events: [
      { name: 'sign_up_started', params: '—', description: 'Registration screen opened' },
      { name: 'sign_up_step_completed', params: '{ step }', description: 'Step 1 or 2 completed' },
      { name: 'sign_up_completed', params: '—', description: 'Registration successful (conversion)' },
      { name: 'sign_up_failed', params: '—', description: 'Registration failed' },
    ],
  },
  {
    id: 'home',
    label: 'Home Screen',
    icon: Globe,
    color: '#d97706',
    file: 'PublicHomeScreen.tsx',
    events: [
      { name: 'home_search_opened', params: '—', description: 'Search bar tapped' },
      { name: 'home_banner_tapped', params: '{ banner_index }', description: 'Hero banner tapped' },
      { name: 'home_service_category_tapped', params: '{ category }', description: 'Service category tapped from home' },
      { name: 'workshop_locator_opened', params: '—', description: 'Workshop locator opened from home' },
    ],
  },
  {
    id: 'services',
    label: 'Service Packages',
    icon: Zap,
    color: '#dc2626',
    file: 'PublicServicePackagesScreen.tsx',
    events: [
      { name: 'service_packages_viewed', params: '—', description: 'Services list screen opened' },
      { name: 'service_detail_viewed', params: '{ service }', description: 'Service detail opened' },
      { name: 'service_category_selected', params: '{ category }', description: 'Category filter selected' },
      { name: 'service_book_now_tapped', params: '{ service }', description: 'Book Now tapped on a service' },
    ],
  },
  {
    id: 'settings',
    label: 'Profile & Settings',
    icon: User,
    color: '#6366f1',
    file: 'SettingsScreen.tsx',
    events: [
      { name: 'profile_viewed', params: '—', description: 'Profile screen opened' },
      { name: 'membership_screen_viewed', params: '—', description: 'Membership section viewed' },
      { name: 'wallet_viewed', params: '—', description: 'Wallet section opened' },
      { name: 'referral_screen_viewed', params: '—', description: 'Referral screen opened' },
      { name: 'referral_share_tapped', params: '—', description: 'Referral share button tapped' },
      { name: 'referral_code_copied', params: '—', description: 'Referral code copied' },
      { name: 'referral_terms_toggled', params: '—', description: 'Referral T&C expanded/collapsed' },
      { name: 'order_history_viewed', params: '—', description: 'Order history opened' },
      { name: 'cart_viewed', params: '—', description: 'Cart opened' },
      { name: 'support_call_tapped', params: '—', description: 'Support phone call initiated' },
      { name: 'social_link_tapped', params: '{ platform }', description: 'Social media link tapped' },
      { name: 'logout_tapped', params: '—', description: 'Logout button tapped' },
      { name: 'delete_account_confirmed', params: '—', description: 'Account deletion confirmed' },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    color: '#0284c7',
    file: 'SearchOverlay.tsx',
    events: [
      { name: 'search_query_entered', params: '{ query }', description: 'User searched something' },
      { name: 'search_result_tapped', params: '{ result_type }', description: 'Search result tapped' },
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop Locator',
    icon: MapPin,
    color: '#be185d',
    file: 'PublicWorkshopLocatorScreen.tsx',
    events: [
      { name: 'workshop_locator_opened', params: '—', description: 'Workshop locator screen opened' },
      { name: 'workshop_directions_tapped', params: '—', description: 'Directions button tapped' },
      { name: 'workshop_call_tapped', params: '—', description: 'Workshop call button tapped' },
    ],
  },
  {
    id: 'misa',
    label: 'MISA AI Chat',
    icon: MessageSquare,
    color: '#7c3aed',
    file: 'AIBookingScreen.tsx',
    events: [
      { name: 'misa_opened', params: '—', description: 'MISA chat screen opened' },
      { name: 'misa_message_sent', params: '—', description: 'User sent a message' },
      { name: 'misa_message_received', params: '—', description: 'AI response received' },
      { name: 'misa_chat_error', params: '—', description: 'Chat error occurred' },
    ],
  },
  {
    id: 'rsa',
    label: 'Roadside Assistance',
    icon: Car,
    color: '#ea580c',
    file: 'RoadsideAssistanceScreen.tsx',
    events: [
      { name: 'rsa_screen_viewed', params: '—', description: 'RSA screen opened' },
      { name: 'rsa_service_tapped', params: '{ service_id }', description: 'RSA service selected' },
      { name: 'rsa_call_now_tapped', params: '—', description: 'RSA call now tapped' },
    ],
  },
  {
    id: 'health_check',
    label: 'Car Health Check',
    icon: Gauge,
    color: '#16a34a',
    file: 'CarHealthCheckScreen.tsx',
    events: [
      { name: 'health_check_started', params: '—', description: 'Health check started' },
      { name: 'health_check_step_completed', params: '{ step }', description: 'A step completed' },
      { name: 'health_check_report_generated', params: '—', description: 'Report generated' },
      { name: 'health_check_submitted', params: '—', description: 'Health check submitted' },
    ],
  },
  {
    id: 'resale',
    label: 'Resale Value',
    icon: Car,
    color: '#4f46e5',
    file: 'ResaleValueScreen.tsx',
    events: [
      { name: 'resale_value_started', params: '—', description: 'Resale calculator opened' },
      { name: 'resale_value_step_completed', params: '{ step }', description: 'Step completed' },
      { name: 'resale_value_submitted', params: '—', description: 'Form submitted' },
      { name: 'resale_value_estimated', params: '—', description: 'Estimate shown' },
    ],
  },
  {
    id: 'fuel',
    label: 'Fuel Calculator',
    icon: Calculator,
    color: '#ca8a04',
    file: 'FuelCostCalculatorScreen.tsx',
    events: [
      { name: 'fuel_calculator_opened', params: '—', description: 'Calculator opened' },
      { name: 'fuel_calculator_used', params: '—', description: 'Calculation performed' },
    ],
  },
  {
    id: 'quiz',
    label: 'Car Quiz',
    icon: Gamepad2,
    color: '#9333ea',
    file: 'CarQuizGameScreen.tsx',
    events: [
      { name: 'car_quiz_started', params: '—', description: 'Quiz started' },
      { name: 'car_quiz_answer_selected', params: '—', description: 'Answer selected' },
      { name: 'car_quiz_completed', params: '{ score }', description: 'Quiz completed' },
    ],
  },
  {
    id: 'push',
    label: 'Push Notifications',
    icon: Bell,
    color: '#0d9488',
    file: 'pushNotifications.ts',
    events: [
      { name: 'push_permission_granted', params: '—', description: 'Push permission granted' },
      { name: 'push_permission_denied', params: '—', description: 'Push permission denied' },
      { name: 'push_token_registered', params: '{ method }', description: 'FCM token registered' },
      { name: 'push_notification_received', params: '{ source }', description: 'Notification received in foreground' },
      { name: 'push_notification_opened', params: '{ source }', description: 'Notification opened' },
    ],
  },
];

const TOTAL_EVENTS = EVENT_CATALOG.reduce((sum, c) => sum + c.events.length, 0);

export default function EventsCatalogSection() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = EVENT_CATALOG
    .filter((cat) => !selectedCategory || cat.id === selectedCategory)
    .map((cat) => ({
      ...cat,
      events: cat.events.filter(
        (ev) =>
          !search ||
          ev.name.toLowerCase().includes(search.toLowerCase()) ||
          ev.description.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.events.length > 0);

  const filteredCount = filtered.reduce((sum, c) => sum + c.events.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Events Catalog</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              All <span className="font-semibold text-violet-600">{TOTAL_EVENTS}</span> tracked events across{' '}
              <span className="font-semibold">{EVENT_CATALOG.length}</span> categories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none w-56"
              />
            </div>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              !selectedCategory
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
            }`}
          >
            <Filter className="w-3 h-3 inline mr-1" />
            All ({TOTAL_EVENTS})
          </button>
          {EVENT_CATALOG.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  selectedCategory === cat.id
                    ? 'text-white border-current'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
                style={selectedCategory === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
              >
                <Icon className="w-3 h-3 inline mr-1" />
                {cat.label} ({cat.events.length})
              </button>
            );
          })}
        </div>

        {search && (
          <p className="text-xs text-gray-500 mt-3">
            Showing {filteredCount} of {TOTAL_EVENTS} events
          </p>
        )}
      </div>

      {/* Events by category */}
      {filtered.map((cat) => {
        const Icon = cat.icon;
        return (
          <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}15` }}>
                <Icon className="w-4 h-4" style={{ color: cat.color }} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{cat.label}</h3>
                <p className="text-xs text-gray-500">{cat.file} · {cat.events.length} events</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60">
                    <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Name</th>
                    <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Parameters</th>
                    <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.events.map((ev, i) => (
                    <tr key={ev.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                      <td className="px-6 py-2.5">
                        <code className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                          {ev.name}
                        </code>
                      </td>
                      <td className="px-6 py-2.5">
                        <span className="text-xs text-gray-600 font-mono">{ev.params}</span>
                      </td>
                      <td className="px-6 py-2.5 text-xs text-gray-600">{ev.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
