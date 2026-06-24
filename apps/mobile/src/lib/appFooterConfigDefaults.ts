export type AppFooterStat = {
  value: string;
  label: string;
};

export type AppFooterConfig = {
  headline_line1: string;
  headline_line2: string;
  stats: [AppFooterStat, AppFooterStat];
  bottom_line: string;
};

export const DEFAULT_APP_FOOTER_CONFIG: AppFooterConfig = {
  headline_line1: "India's #1 AI-Powered",
  headline_line2: 'Car Service Booking Platform',
  stats: [
    { value: '17k+', label: 'Car Serviced' },
    { value: '4.8', label: 'Top-Rated' },
  ],
  bottom_line: '100+ A-GRADE MULTIBRAND WORKSHOPS',
};
