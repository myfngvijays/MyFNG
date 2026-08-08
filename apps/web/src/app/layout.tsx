import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { NotificationProvider } from '@/contexts/NotificationContext';
import MobileBottomNav from '@/components/landing/MobileBottomNav';
import {
  buildRootMetadataFromSettings,
  buildSiteViewportFromSettings,
  getSiteTechnicalSeo,
} from '@/lib/site-technical-seo';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteTechnicalSeo();
  return buildRootMetadataFromSettings(settings);
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSiteTechnicalSeo();
  return buildSiteViewportFromSettings(settings);
}

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
        <Toaster
          position="top-center"
          containerStyle={{
            top: 'max(0.75rem, env(safe-area-inset-top))',
            left: 'env(safe-area-inset-left)',
            right: 'env(safe-area-inset-right)',
          }}
          toastOptions={{
            className: 'text-sm !max-w-[min(24rem,calc(100vw-2rem))]',
          }}
        />
      </body>
    </html>
  );
}
