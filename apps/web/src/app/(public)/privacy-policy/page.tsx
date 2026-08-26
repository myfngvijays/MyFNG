import { Shield, Mail, MapPin } from 'lucide-react';
import { AccordionCard } from '@/components/shared/PolicyAccordion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

import { buildManagedPageMetadata } from '@/lib/site-page-seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/privacy-policy');
}

function SubHeading({ label, title }: { label: string; title: string }) {
  return (
    <h3 className="text-sm sm:text-base font-semibold text-gray-800 mt-5 mb-2">
      <span className="text-blue-600 font-bold mr-1.5">{label}</span>
      {title}
    </h3>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>;
}

function Divider() {
  return <div className="border-t border-gray-100 my-6" />;
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="bg-gradient-to-b from-gray-50 to-white min-h-screen pt-20 sm:pt-24">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: August 26, 2026</p>
        </div>

        {/* Intro — always visible, not collapsible */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 mb-3">
          <Para>
            MY FNG Autocare Private Limited (&ldquo;MY FNG&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to safeguarding the privacy and personal data of users who access or use our website, mobile applications, and related services (collectively, the &ldquo;Platform&rdquo;).
          </Para>
          <Para>
            This Privacy Policy outlines how MY FNG collects, processes, uses, stores, and protects personal data in connection with the use of our Platform and services.
          </Para>
          <Para>
            This Policy is published in compliance with the provisions of the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, and other applicable laws and regulations in India.
          </Para>
          <p className="text-sm text-gray-700 leading-relaxed">
            By accessing or using the Platform, you acknowledge that you have read and understood this Privacy Policy and consent to the collection and processing of your personal data in accordance with its terms.
          </p>
        </div>

        {/* 1. Eligibility — first one expanded */}
        <AccordionCard number="1" title="Eligibility" defaultOpen>
          <Para>The Platform is intended for use by individuals who are 18 years of age or older.</Para>
          <Para>
            MY FNG does not knowingly collect or process personal data from individuals under the age of 18 without verifiable consent from a parent or legal guardian. If MY FNG becomes aware that personal data of a minor has been collected without such consent, we will take appropriate steps to delete such information.
          </Para>
        </AccordionCard>

        {/* 2. Information We Collect */}
        <AccordionCard number="2" title="Information We Collect">
          <Para>We may collect the following categories of personal data when you access or use our Platform:</Para>

          <SubHeading label="A." title="Registration Information" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Name</Bullet>
            <Bullet>Mobile number</Bullet>
            <Bullet>Email address</Bullet>
            <Bullet>Location or address</Bullet>
          </ul>

          <SubHeading label="B." title="Vehicle Information" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Vehicle registration number</Bullet>
            <Bullet>Car model and variant</Bullet>
            <Bullet>Fuel type</Bullet>
            <Bullet>Service history (if voluntarily provided)</Bullet>
          </ul>

          <SubHeading label="C." title="Transaction Information" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Service booking details</Bullet>
            <Bullet>Appointment information</Bullet>
            <Bullet>Workshop interactions</Bullet>
            <Bullet>Payment details (processed through secure third-party payment gateways; MY FNG does not store sensitive financial information such as card details)</Bullet>
          </ul>

          <SubHeading label="D." title="Technical Information" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>IP address</Bullet>
            <Bullet>Browser type and version</Bullet>
            <Bullet>Device information</Bullet>
            <Bullet>Operating system</Bullet>
            <Bullet>Network details</Bullet>
            <Bullet>Crash logs and diagnostic data</Bullet>
          </ul>

          <SubHeading label="E." title="Usage and Behavioral Data" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Pages visited on the Platform</Bullet>
            <Bullet>Search queries and activity</Bullet>
            <Bullet>Interaction timestamps</Bullet>
            <Bullet>Platform usage analytics</Bullet>
          </ul>

          <SubHeading label="F." title="Location Data" />
          <Para>
            We may collect geographic location data to enable location-based services such as identifying nearby workshops, service availability, and facilitating vehicle pickup and delivery.
          </Para>
          <Para>
            If you opt in to Nearby Workshop Alerts in the MyFNG Android or iOS app, this app collects location data to enable nearby workshop alerts even when the app is closed or not in use. This is optional. You can decline or turn it off at any time in Settings → Notifications → Nearby Workshop Alerts and still use booking, workshop search, and other features. We do not sell location data.
          </Para>
        </AccordionCard>

        {/* 3. How We Use Personal Data */}
        <AccordionCard number="3" title="How We Use Personal Data">
          <Para>MY FNG uses the personal data collected for the following purposes:</Para>

          <SubHeading label="A." title="Service Delivery" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>To process and manage service bookings</Bullet>
            <Bullet>To coordinate with partner workshops and service providers</Bullet>
            <Bullet>To arrange vehicle pickup and delivery services</Bullet>
          </ul>

          <SubHeading label="B." title="Customer Support" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>To respond to customer queries and resolve complaints</Bullet>
            <Bullet>To provide updates regarding ongoing or completed services</Bullet>
            <Bullet>To maintain and improve service quality</Bullet>
          </ul>

          <SubHeading label="C." title="Platform Improvement" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>To analyze user behavior and usage patterns</Bullet>
            <Bullet>To improve platform functionality, features, and performance</Bullet>
            <Bullet>To enhance overall user experience</Bullet>
          </ul>

          <SubHeading label="D." title="Communication" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>To send booking confirmations and service-related notifications</Bullet>
            <Bullet>To provide important updates regarding services or platform changes</Bullet>
            <Bullet>To share promotional communications, offers, and new services (where permitted by applicable law)</Bullet>
          </ul>

          <SubHeading label="E." title="Security and Fraud Prevention" />
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>To detect, prevent, and investigate fraudulent or unauthorized activities</Bullet>
            <Bullet>To prevent misuse of the Platform</Bullet>
            <Bullet>To ensure the security and integrity of our systems and services</Bullet>
          </ul>

          <Para>
            MY FNG processes personal data only for lawful purposes, including based on user consent, for the performance of a contract, compliance with legal obligations, and legitimate business interests, in accordance with applicable laws.
          </Para>
        </AccordionCard>

        {/* 4. Third-Party Tracking */}
        <AccordionCard number="4" title="Third-Party Tracking and Advertising Technologies">
          <Para>
            To improve our Platform, services, and marketing effectiveness, MY FNG may use third-party analytics and advertising technologies. These tools help us understand user behavior, measure performance, and deliver relevant advertisements.
          </Para>

          <SubHeading label="A." title="Google Analytics and Advertising Tools" />
          <Para>
            MY FNG may use Google Analytics 4 (GA4) and related Google services to analyze how users interact with the Platform, including traffic patterns, user behavior, and overall performance.
          </Para>
          <Para>
            Google Analytics may collect information such as device identifiers, IP address, and usage data in accordance with Google&apos;s privacy policies.
          </Para>
          <Para>
            Users may opt out of Google Analytics tracking by using the Google Analytics opt-out browser add-on or by adjusting their browser settings.
          </Para>

          <SubHeading label="B." title="Meta Business Tools" />
          <Para>
            MY FNG may use Meta Pixel and Conversions API (CAPI) to measure advertising performance and improve marketing campaigns.
          </Para>
          <Para>These tools may process limited personal data, including encrypted or hashed identifiers (such as email addresses or phone numbers), to:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Create Custom And Lookalike Audiences</Bullet>
            <Bullet>Measure Campaign Effectiveness</Bullet>
            <Bullet>Deliver Relevant Advertisements</Bullet>
          </ul>
          <Para>
            Users can manage their advertising preferences directly through their accounts on respective platforms, including Facebook and Instagram.
          </Para>
          <Para>
            These third-party tools may involve the transfer and processing of data outside India. MY FNG ensures that such processing is carried out in accordance with applicable data protection laws and appropriate safeguards.
          </Para>
        </AccordionCard>

        {/* 5. Sharing and Disclosure */}
        <AccordionCard number="5" title="Sharing and Disclosure of Information">
          <Para>MY FNG does not sell, rent, or trade personal data to third parties.</Para>
          <Para>Personal data may be shared only in the following circumstances:</Para>

          <SubHeading label="A." title="Service Partners" />
          <Para>
            We may share relevant personal data with verified workshops and service partners solely for the purpose of fulfilling service requests, including vehicle servicing, pickup, and delivery.
          </Para>
          <Para>
            Such partners are contractually obligated to use the data only for the intended purpose and to maintain appropriate confidentiality and security standards.
          </Para>

          <SubHeading label="B." title="Legal and Regulatory Requirements" />
          <Para>
            We may disclose personal data where required to do so by applicable law, regulation, legal process, or governmental request, including compliance with court orders or lawful investigations.
          </Para>

          <SubHeading label="C." title="Service Providers" />
          <Para>We may engage trusted third-party service providers to support the operation of our Platform and services, including:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Cloud hosting and infrastructure providers</Bullet>
            <Bullet>Payment gateway providers</Bullet>
            <Bullet>Analytics and tracking service providers</Bullet>
            <Bullet>Communication and notification service providers</Bullet>
          </ul>
          <Para>
            These service providers process personal data on our behalf under contractual obligations to ensure confidentiality, security, and compliance with applicable data protection laws.
          </Para>

          <SubHeading label="D." title="Business Transfers" />
          <Para>
            In the event of a merger, acquisition, restructuring, or sale of assets, personal data may be transferred to the acquiring or successor entity, subject to appropriate confidentiality and data protection safeguards.
          </Para>
          <Para>
            MY FNG ensures that any sharing of personal data is limited to what is necessary for the specific purpose and is carried out in accordance with applicable data protection laws.
          </Para>
        </AccordionCard>

        {/* 6. Aggregator Service Disclaimer */}
        <AccordionCard number="6" title="Aggregator Service Disclaimer">
          <Para>
            MY FNG operates solely as a technology platform that facilitates connections between customers and independent automotive workshops and service providers.
          </Para>
          <Para>
            While MY FNG undertakes reasonable due diligence and verification of partner workshops, all vehicle servicing, repairs, and related services are performed directly by independent third-party service providers.
          </Para>
          <Para>
            MY FNG does not control, supervise, or guarantee the quality, safety, or legality of services provided by such third parties. Accordingly, MY FNG shall not be liable for any loss, damage, deficiency, or dispute arising from services rendered by partner workshops, except to the extent required under applicable law.
          </Para>
          <Para>
            Users acknowledge that any service availed through the Platform is at their own discretion and risk.
          </Para>
        </AccordionCard>

        {/* 7. Data Security */}
        <AccordionCard number="7" title="Data Security">
          <Para>MY FNG implements appropriate technical and organizational measures to safeguard personal data against unauthorized access, disclosure, alteration, or destruction. These measures include:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Encryption of data during transmission</Bullet>
            <Bullet>Secure servers and hosting infrastructure</Bullet>
            <Bullet>Role-based access controls and restricted employee access</Bullet>
            <Bullet>Internal data protection policies and procedures</Bullet>
          </ul>
          <Para>We regularly review and update our security practices to maintain the integrity and security of personal data.</Para>
          <Para>
            However, despite our best efforts, no method of transmission over the internet or electronic storage is completely secure. Therefore, MY FNG cannot guarantee absolute security of personal data.
          </Para>
          <Para>
            In the event of a data breach, MY FNG will take appropriate steps to mitigate the impact and will notify affected users and relevant authorities as required under applicable law.
          </Para>
        </AccordionCard>

        {/* 8. Data Retention */}
        <AccordionCard number="8" title="Data Retention">
          <Para>MY FNG retains personal data only for as long as necessary to:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Provide and manage services requested by users</Bullet>
            <Bullet>Comply with applicable legal and regulatory obligations</Bullet>
            <Bullet>Resolve disputes or enforce agreements</Bullet>
            <Bullet>Maintain records for legitimate business purposes</Bullet>
          </ul>
          <Para>
            Certain records may be retained for longer periods if required by law or if necessary for legitimate business purposes, such as accounting, fraud prevention, or dispute resolution.
          </Para>
          <Para>
            Once personal data is no longer required, MY FNG will take reasonable steps to securely delete or anonymize the data.
          </Para>
        </AccordionCard>

        {/* 9. Your Rights Under the DPDP Act */}
        <AccordionCard number="9" title="Your Rights Under the DPDP Act, 2023">
          <Para>Under the Digital Personal Data Protection Act, 2023, users have the following rights regarding their personal data:</Para>

          <SubHeading label="A." title="Right to Access" />
          <Para>You may request a summary of the personal data being processed about you.</Para>

          <SubHeading label="B." title="Right to Correction" />
          <Para>You may request correction of any inaccurate, incomplete, or outdated personal data.</Para>

          <SubHeading label="C." title="Right to Erasure" />
          <Para>You may request deletion of your personal data where permitted by law.</Para>

          <SubHeading label="D." title="Right to Withdraw Consent" />
          <Para>You may withdraw previously given consent for data processing at any time. Withdrawal does not affect the lawfulness of processing prior to withdrawal.</Para>

          <SubHeading label="E." title="Right to Nominate" />
          <Para>You may nominate another individual to exercise your data protection rights in the event of your death or incapacity.</Para>

          <SubHeading label="F." title="Right to Grievance Redressal" />
          <Para>You may contact the designated grievance officer to address any concerns regarding the processing of your personal data.</Para>

          <Para>
            MY FNG will acknowledge your request within 48 hours and endeavor to resolve it within 30 days, in accordance with applicable law.
          </Para>
        </AccordionCard>

        {/* 10. Cookies */}
        <AccordionCard number="10" title="Cookies and Similar Technologies">
          <Para>MY FNG uses cookies and similar technologies to enhance the user experience on our Platform, including to:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Remember user preferences and settings</Bullet>
            <Bullet>Analyze website and platform traffic</Bullet>
            <Bullet>Improve platform functionality, performance, and features</Bullet>
          </ul>
          <Para>
            Users may disable cookies through their browser or device settings; however, some Platform features may not function properly if cookies are disabled.
          </Para>
        </AccordionCard>

        {/* 11. Communications */}
        <AccordionCard number="11" title="Communications">
          <Para>By providing your contact information, you consent to receive communications from MY FNG, which may include:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Booking confirmations and service-related notifications</Bullet>
            <Bullet>Customer support messages</Bullet>
            <Bullet>Promotional communications, offers, or updates via SMS, WhatsApp, RCS, email, or phone calls</Bullet>
          </ul>
          <Para>
            Users may opt out of promotional communications at any time by following the opt-out instructions provided in the communication or by contacting MY FNG directly.
          </Para>
        </AccordionCard>

        {/* 12. Account and Data Deletion */}
        <AccordionCard number="12" title="Account and Data Deletion">
          <Para>Users may request deletion of their account and personal data through the following methods:</Para>

          <SubHeading label="A." title="Platform Request" />
          <Para>Users may submit a deletion request through their account settings, if available.</Para>

          <SubHeading label="B." title="Web Request" />
          <Para>Users may submit a deletion request through:</Para>
          <a href="https://myfng.in/contact-us" className="text-blue-600 font-medium text-sm underline hover:text-blue-800 ml-1 block mb-3">
            https://myfng.in/contact-us
          </a>
          <Para>
            Deletion requests are typically processed within 90 days, except where retention is required for legal, regulatory, or legitimate business purposes.
          </Para>
        </AccordionCard>

        {/* 13. Intellectual Property */}
        <AccordionCard number="13" title="Intellectual Property">
          <Para>
            All content on the MY FNG Platform, including but not limited to trademarks, service marks, logos, software, and materials, is the property of MY FNG Autocare Private Limited.
          </Para>
          <Para>Users are prohibited from:</Para>
          <ul className="space-y-1.5 mb-3 ml-1">
            <Bullet>Copying, reproducing, or modifying Platform content</Bullet>
            <Bullet>Distributing or publicly displaying Platform content</Bullet>
            <Bullet>Reverse engineering or decompiling software or materials</Bullet>
            <Bullet>Commercially exploiting Platform content without prior written permission from MY FNG</Bullet>
          </ul>
        </AccordionCard>

        {/* 14. Policy Updates */}
        <AccordionCard number="14" title="Policy Updates">
          <Para>
            MY FNG may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements.
          </Para>
          <Para>
            Any updates will be posted on this page with a revised &ldquo;Last Updated&rdquo; date. Continued use of the Platform after such updates constitutes acceptance of the updated Privacy Policy.
          </Para>
        </AccordionCard>

        {/* 15. Governing Law */}
        <AccordionCard number="15" title="Governing Law and Jurisdiction">
          <Para>
            This Privacy Policy shall be governed by and construed in accordance with the laws of India.
          </Para>
          <Para>
            Any disputes arising out of or in connection with this Privacy Policy shall be subject to the exclusive jurisdiction of the competent courts in Thane, Maharashtra, India.
          </Para>
        </AccordionCard>

        {/* 16. Grievance Officer */}
        <AccordionCard number="16" title="Grievance Officer">
          <Para>
            If you have any questions, concerns, or complaints regarding this Privacy Policy or the processing of your personal data, you may contact the designated Grievance and Data Protection Officer:
          </Para>
          <div className="mt-4 bg-blue-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="text-sm font-semibold text-gray-900">Nitish Jha</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-semibold text-gray-900">cs-reply@myfng.in</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="text-sm font-semibold text-gray-900">
                  A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate, Thane (West), Maharashtra - 400604, India
                </p>
              </div>
            </div>
          </div>
          <Divider />
          <Para>
            For general support inquiries, users may also contact: <span className="font-semibold">info@myfng.in</span>
          </Para>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> MY FNG will acknowledge grievances within 48 hours and aim to resolve them within 30 days, in accordance with the DPDP Act, 2023.
              If a grievance is not satisfactorily resolved, users may escalate the matter to the appropriate regulatory authority under the applicable law.
            </p>
          </div>
        </AccordionCard>

        {/* Closing */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 bg-gray-100 rounded-xl px-4 py-3 inline-block">
            If you do not agree with this Privacy Policy, please discontinue use of the Platform and Services.
          </p>
        </div>

        <div className="h-8" />
      </div>
    </main>
      <Footer />
    </>
  );
}
