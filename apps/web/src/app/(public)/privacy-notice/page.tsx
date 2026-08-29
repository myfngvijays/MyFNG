import type { ReactNode } from 'react';
import Link from 'next/link';
import { Shield, Mail, MapPin, Phone } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { GRIEVANCE_OFFICER } from '@/lib/dpdp/constants';
import { buildManagedPageMetadata } from '@/lib/site-page-seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/privacy-notice');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-7 text-gray-700">{children}</div>
    </section>
  );
}

export default function PrivacyNoticePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-20 sm:pt-24">
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
          <div className="text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Privacy Notice</h1>
            <p className="mt-2 text-sm text-gray-500">DPDP Act, 2023 · Last updated 26 August 2026</p>
          </div>

          <Section title="Who we are">
            <p>
              MY FNG Autocare Private Limited (&ldquo;MY FNG&rdquo;) is a Data Fiduciary for personal data
              collected on myfng.in and the MY FNG mobile apps. Full policy:{' '}
              <Link href="/privacy-policy" className="text-blue-700 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="What we collect">
            <ul className="list-disc space-y-1 pl-5">
              <li>Identity and contact: name, mobile, email, address / pincode</li>
              <li>Vehicle: registration number, make, model, fuel type, service history</li>
              <li>Bookings, payments (via Razorpay — we do not store card numbers), workshop notes</li>
              <li>Calls / WhatsApp / OTP, location when you use pickup, maps, or RSA</li>
              <li>Device and usage: IP, browser, crash logs; optional analytics / ads cookies</li>
            </ul>
          </Section>

          <Section title="Why we use it">
            <ul className="list-disc space-y-1 pl-5">
              <li>To take and complete a booking or roadside request (contract / service)</li>
              <li>Customer support, invoices, fraud and security</li>
              <li>Legal records (tax, disputes)</li>
              <li>Promotional messages only if you opt in</li>
              <li>Analytics and advertising cookies only if you opt in on the cookie banner</li>
            </ul>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep booking and account data while you use the Platform and for a limited period after
              (typically up to 90 days after a deletion request, longer if law or a dispute requires it).
              Cookie identifiers follow the cookie banner choice.
            </p>
          </Section>

          <Section title="Third parties">
            <p>We do not sell personal data. We share what is needed with:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Partner workshops, pickup/delivery staff, RSA partners</li>
              <li>Supabase (hosting/database), Vercel (website), Razorpay (payments)</li>
              <li>WhatsApp / Meta, SMS/RCS, SARV / Tata Smartflo (telephony)</li>
              <li>Google (Maps, optional Analytics/GTM), Microsoft Clarity (optional), Firebase (app push)</li>
              <li>Government or courts when the law requires</li>
            </ul>
            <p>Some processors may handle data outside India with contractual safeguards.</p>
          </Section>

          <Section title="Your rights">
            <p>Under the DPDP Act, 2023 you may:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Access a summary of personal data we process about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request erasure where the law allows</li>
              <li>Withdraw consent for optional processing (marketing, analytics, ads)</li>
              <li>Nominate someone to exercise rights if you cannot</li>
              <li>Raise a grievance with the officer below</li>
            </ul>
            <p>
              Use the{' '}
              <Link href="/data-rights" className="font-semibold text-blue-700 underline">
                data-rights request form
              </Link>
              . We aim to acknowledge within {GRIEVANCE_OFFICER.acknowledgeHours} hours and resolve within{' '}
              {GRIEVANCE_OFFICER.resolveDays} days.
            </p>
          </Section>

          <Section title="Grievance and Data Protection Officer">
            <div className="space-y-2 rounded-xl bg-blue-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-gray-900">
                <Shield className="h-4 w-4 text-blue-700" />
                {GRIEVANCE_OFFICER.name} — {GRIEVANCE_OFFICER.title}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-700" />
                <a className="underline" href={`mailto:${GRIEVANCE_OFFICER.email}`}>
                  {GRIEVANCE_OFFICER.email}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-700" />
                <a className="underline" href={`tel:${GRIEVANCE_OFFICER.phone.replace(/[^\d+]/g, '')}`}>
                  {GRIEVANCE_OFFICER.phone}
                </a>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                {GRIEVANCE_OFFICER.address}
              </p>
            </div>
            <p>
              General support: {GRIEVANCE_OFFICER.supportEmail}. If we do not resolve a grievance, you may
              escalate to the Data Protection Board of India when that channel is available.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}
