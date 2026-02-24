import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { NotificationProvider } from '@/contexts/NotificationContext';
import MobileBottomNav from '@/components/landing/MobileBottomNav';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyFNG - Complete Workshop Management Solution',
  description: 'Professional workshop management and service platform',
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
