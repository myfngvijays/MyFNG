export type AppFooterStat = {
  value: string;
  label: string;
};

export type AppFooterTrustGrid = [
  AppFooterStat,
  AppFooterStat,
  AppFooterStat,
  AppFooterStat,
];

export type AppFooterConfig = {
  headline_line1: string;
  headline_line2: string;
  stats: [AppFooterStat, AppFooterStat];
  trust_grid: AppFooterTrustGrid;
  bottom_line: string;
};

export const DEFAULT_APP_FOOTER_TRUST_GRID: AppFooterTrustGrid = [
  { value: '17K+', label: 'Cars Serviced' },
  { value: '4.8', label: 'Reviews' },
  { value: '100+', label: 'Workshops' },
  { value: '24/7', label: 'Support' },
];

export const DEFAULT_APP_FOOTER_CONFIG: AppFooterConfig = {
  headline_line1: "India's #1 AI-Powered",
  headline_line2: 'Car Service Booking Platform',
  stats: [
    { value: '17k+', label: 'Car Serviced' },
    { value: '4.8', label: 'Top-Rated' },
  ],
  trust_grid: DEFAULT_APP_FOOTER_TRUST_GRID,
  bottom_line: '100+ A-GRADE MULTIBRAND WORKSHOPS',
};
