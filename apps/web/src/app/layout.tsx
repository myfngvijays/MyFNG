import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { NotificationProvider } from '@/contexts/NotificationContext';
import MobileBottomNav from '@/components/landing/MobileBottomNav';

export const dynamic = 'force-dynamic';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://myfng.in'),
  title: {
    default: "My FNG - India's First AI-Powered Car Service Booking Platform",
    template: '%s | MyFNG',
  },
  description:
    "India's first AI-powered car service booking platform. Book periodic service, AC repair, engine service & more at verified workshops in Mumbai, Pune & Thane.",
  keywords: [
    'car service near me',
    'car repair near me',
    'best mechanic near me',
    'car servicing Mumbai',
    'car servicing Pune',
    'MYFNG',
  ],
  authors: [{ name: 'MYFNG' }],
  creator: 'MYFNG',
  publisher: 'MYFNG',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon-32x32.png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <NotificationProvider>
          {children}
          <MobileBottomNav />
        </NotificationProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
