import { FileText, Mail, Phone } from 'lucide-react';
import { AccordionCard } from '@/components/shared/PolicyAccordion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

import { buildManagedPageMetadata } from '@/lib/site-page-seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/terms-and-conditions');
}

function NumberedHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-start gap-3 mb-2 mt-8 first:mt-0">
      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <h3 className="text-base font-semibold text-gray-900 leading-7 pt-0.5">{title}</h3>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] text-gray-700 leading-7">
      <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function IndentBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] text-gray-700 leading-7 ml-1 sm:ml-4">
      <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-gray-700 leading-7 mb-4">{children}</p>;
}

function DefinitionItem({ number, term, desc }: { number: string; term: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
        {number}. {term}
      </p>
      <p className="mt-1.5 text-[15px] leading-7 text-gray-700">{desc}</p>
    </div>
  );
}

export default function TermsAndConditionsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-gradient-to-b from-gray-50 to-white min-h-screen pt-20 sm:pt-24">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-gray-500">Effective Date: March 2026</p>
        </div>

        {/* CONTRACTUAL RELATIONSHIP — first one expanded */}
        <AccordionCard defaultOpen title="Contractual Relationship" variant="bar">
          <Para>
            My FNG Autocare Private Limited, a company duly incorporated under the Companies Act, 2013 and having its registered office at A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate, Thane (West), Thane - 400604, Maharashtra, India (&ldquo;My FNG&rdquo;, &ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), owns and operates a digital platform under the brand name My FNG. The Platform enables users to discover, schedule, and manage car maintenance, repair, inspection, and other related automotive services offered by independent third-party service providers (&ldquo;Partner Workshops&rdquo;).
          </Para>
          <Para>
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the My FNG website available at www.myfng.in (&ldquo;Website&rdquo;) and the My FNG mobile application (&ldquo;App&rdquo;), including all associated features, content, functionalities, and services provided through them (collectively referred to as the &ldquo;Services&rdquo;). The Website and the App are together referred to as the &ldquo;Platform.&rdquo;
          </Para>
          <Para>
            These Terms constitute a legally binding agreement between My FNG and any person who accesses or uses the Platform (&ldquo;User&rdquo;, &ldquo;you&rdquo;, or &ldquo;your&rdquo;). By accessing, visiting, registering on, downloading, or using the Platform, or by availing any Services through it, you acknowledge that you have read, understood, and agreed to be bound by these Terms, thereby establishing a contractual relationship between you and the Company.
          </Para>
          <Para>
If you do not agree with any part of these Terms, you must not access or use the Platform or Services and should discontinue usage immediately.
          </Para>
          <Para>
These Terms supersede and replace all prior or contemporaneous agreements, communications, or understandings between you and the Company, whether written or oral, relating to the access to or use of the Platform or Services. Users are advised to review these Terms carefully before using the Platform or availing any Services facilitated through it.
          </Para>
          <Para>
My FNG reserves the right, at its sole discretion, to modify, revise, or update these Terms at any time in order to reflect changes in applicable laws, regulatory requirements, business practices, operational needs, or platform policies (including but not limited to Google Play Developer Program policies). Any such updates shall be published on the Platform at https://myfng.in/terms-and-conditions and shall become effective immediately upon publication.
          </Para>
          <Para>
            You are responsible for periodically reviewing these Terms for updates. My FNG shall not be obligated to provide individual notifications of such changes. Your continued access to or use of the Platform or Services after any revised Terms are posted shall constitute your acceptance of the updated Terms. References to &ldquo;Terms&rdquo; shall refer to the most current version available on the Platform.
          </Para>
          <Para>
Information, listings, and content made available on the Platform are provided for general facilitation purposes only and should not be considered a substitute for independent verification, inspection, or professional judgment by the User.
          </Para>
          <Para>
These Terms constitute an electronic contract under applicable Indian laws, including the Indian Contract Act, 1872 and the Information Technology Act, 2000, along with the rules and amendments made thereunder. This electronic record is generated by automated systems and does not require any physical, electronic, or digital signature to be valid and enforceable.
          </Para>
        </AccordionCard>

        {/* DEFINITIONS */}
        <AccordionCard defaultOpen title="Definitions" variant="bar">
          <Para>
            Unless the context otherwise requires, the following capitalized terms used in these Terms &amp; Conditions shall have the meanings assigned to them below. Words denoting the singular shall include the plural and vice versa, and words denoting any gender shall include all genders.
          </Para>
          <div className="space-y-3">
            <DefinitionItem number="1" term="Account" desc="means the registered user account created by a User on the Platform for the purpose of accessing and using the Services." />
            <DefinitionItem number="2" term="Additional Services" desc="means any services, repairs, replacements, inspections, or other works requested by the User or identified during inspection that fall outside the scope of the selected Service Package." />
            <DefinitionItem number="3" term="Affiliate" desc='means any entity that directly or indirectly controls, is controlled by, or is under common control with My FNG, where "control" means ownership of more than fifty percent (50%) of the voting rights or equity interests of such entity.' />
            <DefinitionItem number="4" term="Applicable Law" desc="means all statutes, enactments, acts of legislature, rules, regulations, notifications, circulars, guidelines, policies, directions, or orders having the force of law in India, as amended or re-enacted from time to time." />
            <DefinitionItem number="5" term="Booking" desc="means a service request or appointment initiated by a User through the Platform and confirmed by My FNG and/or a Partner Workshop for the provision of automotive services." />
            <DefinitionItem number="6" term="Charges" desc="means all amounts payable by the User in relation to the Services, including but not limited to service fees, labour charges, inspection fees, facilitation charges, cost of spare parts, applicable taxes, levies, and any other applicable charges." />
            <DefinitionItem number="7" term="Company" desc='means My FNG Autocare Private Limited, operating under the brand name "My FNG", and includes its affiliates, successors, and permitted assigns.' />
            <DefinitionItem number="8" term="Content" desc="means all text, graphics, images, logos, designs, software, audio, video, data, information, and other material made available on or through the Platform, whether owned by My FNG or licensed from third parties." />
            <DefinitionItem number="9" term="Partner Workshop" desc="means an independent third-party automobile service provider, garage, or workshop that is listed, empanelled, or otherwise accessible through the Platform for providing automotive services to Users." />
            <DefinitionItem number="10" term="Platform" desc="means collectively the My FNG website located at www.myfng.in, the My FNG mobile application, and all associated digital interfaces, features, tools, systems, and technologies operated by the Company." />
            <DefinitionItem number="11" term="Privacy Policy" desc="means the policy published by My FNG describing the collection, use, storage, and protection of User Data, as updated or amended from time to time." />
            <DefinitionItem number="12" term="Service Package" desc="means a predefined bundle of automotive services displayed on the Platform with a defined scope, inclusions, exclusions, and indicative pricing." />
            <DefinitionItem number="13" term="Services" desc="means the technology-enabled facilitation services provided by My FNG through the Platform, including but not limited to appointment scheduling, service coordination, communication, customer support, and related features, and expressly excludes the physical performance of automotive repairs, maintenance, or inspection unless explicitly stated otherwise." />
            <DefinitionItem number="14" term="Terms" desc='or "Terms & Conditions" means these Terms & Conditions, including all schedules, policies, guidelines, and documents incorporated herein by reference, as amended from time to time.' />
            <DefinitionItem number="15" term="User" desc='or "you" or "your" means any individual, company, partnership, or legal entity that accesses, browses, registers on, or uses the Platform or avails any Services through the Platform.' />
            <DefinitionItem number="16" term="User Data" desc="means all information, details, data, documents, images, or content provided or generated by a User while accessing or using the Platform, including personal information, vehicle information, service history, and communication records." />
            <DefinitionItem number="17" term="Vehicle" desc="means any passenger car or automobile registered in India and owned, leased, or lawfully used by the User in respect of which Services are requested through the Platform." />
          </div>
        </AccordionCard>

        {/* SERVICES */}
        <AccordionCard defaultOpen title="Services" variant="bar">
          <NumberedHeading number="1" title="Nature of Services" />
          <Para>My FNG provides a technology-enabled facilitation platform that enables Users to discover, request, schedule, and manage automotive maintenance, repair, inspection, and roadside support services offered by independent third-party service providers (&ldquo;Partner Workshops&rdquo; and &ldquo;RSA Partners&rdquo;).</Para>
          <Para>My FNG&apos;s role is strictly limited to providing digital infrastructure, coordination tools, and customer support to enable such interactions between Users and service providers.</Para>

          <NumberedHeading number="2" title="No Direct Provision of Automotive or Roadside Services" />
          <Para>My FNG does not itself perform, operate, supervise, or control any physical automotive or roadside services, including but not limited to vehicle inspection, repair, replacement of parts, diagnostics, towing, jump-start assistance, or on-road support, unless expressly stated in writing.</Para>
          <Para>All such services are performed solely by independent third-party service providers.</Para>

          <NumberedHeading number="3" title="Service Facilitation Scope" />
          <Para>The Services facilitated through the Platform may include, without limitation:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Periodic and general car servicing</Bullet>
            <Bullet>Mechanical, electrical, and diagnostic assistance</Bullet>
            <Bullet>Car air-conditioning, battery, tyre, and wheel-related services</Bullet>
            <Bullet>Roadside Assistance (RSA), including:</Bullet>
            <IndentBullet>Vehicle towing</IndentBullet>
            <IndentBullet>Battery jump-start support</IndentBullet>
            <IndentBullet>Flat tyre assistance</IndentBullet>
            <IndentBullet>Emergency fuel delivery (where available)</IndentBullet>
            <IndentBullet>Minor on-road mechanical or electrical assistance</IndentBullet>
            <Bullet>Appointment scheduling and booking confirmations</Bullet>
            <Bullet>Service coordination and communication between Users and service providers</Bullet>
            <Bullet>Sharing of estimates, updates, images, or service status (where available)</Bullet>
            <Bullet>Customer support and escalation assistance</Bullet>
          </ul>
          <Para>Availability of specific Services may vary depending on location, time, vehicle type, operational limitations, and the availability of Partner Workshops or RSA Partners.</Para>

          <NumberedHeading number="4" title="Service Packages, RSA Requests, and Additional Services" />
          <Para>Certain Services may be offered as predefined Service Packages with defined inclusions and exclusions.</Para>
          <Para>Roadside Assistance services are typically provided on a request or emergency basis and may be subject to distance limits, service caps, or separate Charges.</Para>
          <Para>Any work, repair, or assistance beyond the stated scope of a Service Package or RSA request shall be treated as Additional Services and shall only be performed after obtaining the User&apos;s consent and approval of the applicable Charges.</Para>

          <NumberedHeading number="5" title="Indicative Information and Response Times" />
          <Para>Any pricing, response times, distance coverage, or estimated arrival times displayed on the Platform for RSA or other Services are indicative only.</Para>
          <Para>Actual response times and costs may vary due to factors including but not limited to:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Traffic conditions</Bullet>
            <Bullet>Location accessibility</Bullet>
            <Bullet>Weather conditions</Bullet>
            <Bullet>Availability of service providers</Bullet>
            <Bullet>Vehicle condition</Bullet>
            <Bullet>Operational constraints</Bullet>
          </ul>
          <Para>Such factors are beyond the control of My FNG.</Para>

          <NumberedHeading number="6" title="Appointment-Based and On-Demand Services" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Regular car servicing and repair Services are generally provided on an appointment-only basis.</Bullet>
            <Bullet>Roadside Assistance (RSA) services may be provided on an on-demand or emergency basis, subject to availability and operational feasibility.</Bullet>
            <Bullet>My FNG does not guarantee immediate assistance or minimum response times.</Bullet>
          </ul>

          <NumberedHeading number="7" title="Right to Modify, Limit, or Discontinue Services" />
          <Para>My FNG reserves the right, at its sole discretion, to add, modify, restrict, suspend, or discontinue any Service, Service Package, RSA feature, coverage area, pricing structure, or Platform functionality at any time, whether temporarily or permanently, without prior notice.</Para>

          <NumberedHeading number="8" title="No Warranty or Guarantee by My FNG" />
          <Para>My FNG does not provide any warranty, assurance, or guarantee with respect to:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>The quality or outcome of services provided by Partner Workshops or RSA Partners</Bullet>
            <Bullet>The timeliness of service delivery or response</Bullet>
            <Bullet>The prevention of future breakdowns, failures, or emergencies</Bullet>
          </ul>
          <Para>Any warranty or service assurance, if offered, is provided solely by the respective third-party service provider and shall be subject to their individual terms and conditions.</Para>

          <NumberedHeading number="9" title="No Agency or Employment Relationship" />
          <Para>Nothing in these Terms shall be construed to create any partnership, agency, employment, franchise, or joint venture relationship between My FNG and any Partner Workshop, RSA Partner, or User.</Para>
          <Para>All third-party service providers operate independently and are solely responsible for the services they perform.</Para>
        </AccordionCard>

        {/* ELIGIBILITY */}
        <AccordionCard defaultOpen title="Eligibility" variant="bar">
          <NumberedHeading number="1" title="Age and Legal Capacity" />
          <Para>Access to and use of the Platform and Services is available only to individuals who are at least eighteen (18) years of age and are legally competent to enter into a binding contract under Applicable Law.</Para>
          <Para>By accessing or using the Platform, you represent and warrant that you meet these eligibility requirements.</Para>

          <NumberedHeading number="2" title="Authority to Act" />
          <Para>If you are accessing or using the Platform on behalf of any organization, company, partnership, or other legal entity, you represent and warrant that you have the full authority and legal capacity to bind such entity to these Terms.</Para>
          <Para>In such cases, references to &ldquo;User&rdquo;, &ldquo;you&rdquo;, or &ldquo;your&rdquo; shall include the relevant entity.</Para>

          <NumberedHeading number="3" title="Vehicle Ownership or Lawful Use" />
          <Para>You must be the lawful owner, authorized user, or duly permitted custodian of the Vehicle in respect of which Services are requested through the Platform.</Para>
          <Para>My FNG shall not be responsible for verifying the ownership, registration status, or usage rights of any Vehicle.</Para>

          <NumberedHeading number="4" title="Accurate Information Requirement" />
          <Para>You agree to provide true, accurate, current, and complete information while:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>creating an Account</Bullet>
            <Bullet>requesting Services</Bullet>
            <Bullet>communicating through the Platform</Bullet>
          </ul>
          <Para>This includes personal details, vehicle information, and location data where applicable.</Para>
          <Para>My FNG reserves the right to suspend, restrict, or deny access if any information provided is found to be false, inaccurate, misleading, or incomplete.</Para>

          <NumberedHeading number="5" title="Technical and Access Requirements" />
          <Para>To access and use the Platform, you must have:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>A compatible device and supported operating system</Bullet>
            <Bullet>Active internet connectivity</Bullet>
            <Bullet>The ability to receive calls, SMS messages, or platform notifications</Bullet>
          </ul>
          <Para>My FNG does not guarantee uninterrupted, secure, or error-free access to the Platform and shall not be liable for access issues arising from technical limitations, connectivity failures, or third-party service disruptions beyond its control.</Para>

          <NumberedHeading number="6" title="Compliance with Laws and Platform Policies" />
          <Para>You agree to use the Platform and Services in compliance with:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>all Applicable Laws</Bullet>
            <Bullet>these Terms &amp; Conditions</Bullet>
            <Bullet>any guidelines, policies, or instructions communicated by My FNG from time to time.</Bullet>
          </ul>
          <Para>Individuals who are legally restricted, disqualified, or prohibited by law or court order from entering into contractual relationships are not eligible to use the Platform.</Para>

          <NumberedHeading number="7" title="Right to Refuse or Restrict Access" />
          <Para>My FNG reserves the right, at its sole discretion, to refuse registration, restrict access, suspend, or terminate eligibility to use the Platform or Services, either temporarily or permanently, without prior notice, where:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Eligibility criteria are not met</Bullet>
            <Bullet>False or misleading information is provided</Bullet>
            <Bullet>Misuse, abuse, or fraudulent activity is detected</Bullet>
            <Bullet>Continued access poses legal, operational, or security risks</Bullet>
          </ul>
        </AccordionCard>

        {/* USE OF SERVICES */}
        <AccordionCard defaultOpen title="Use of Services" variant="bar">
          <NumberedHeading number="1" title="Permitted Use" />
          <Para>Subject to compliance with these Terms, My FNG grants the User a limited, personal, non-exclusive, non-transferable, and revocable right to access and use the Platform and Services solely for lawful purposes related to obtaining automotive maintenance, repair, inspection, or roadside assistance services for the User&apos;s own Vehicle.</Para>

          <NumberedHeading number="2" title="Account Responsibility" />
          <Para>Where account creation is required, the User is solely responsible for:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Maintaining the confidentiality of account credentials</Bullet>
            <Bullet>All activities carried out through the User&apos;s Account</Bullet>
            <Bullet>Promptly notifying My FNG of any unauthorized access, suspected misuse, or security breach</Bullet>
          </ul>
          <Para>My FNG shall not be liable for any loss or damage arising from unauthorized use of the User&apos;s Account.</Para>

          <NumberedHeading number="3" title="Service Requests and Approvals" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>All service requests must be initiated through the Platform in the manner prescribed.</Bullet>
            <Bullet>The User shall review service descriptions, scope, inclusions, exclusions, and applicable Charges before confirming a Booking.</Bullet>
            <Bullet>Any Additional Services, including repairs, part replacements, or extended RSA support, shall be undertaken only after the User&apos;s express approval.</Bullet>
          </ul>

          <NumberedHeading number="4" title="Appointment-Based and On-Demand Services" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Non-emergency automotive Services are provided strictly on an appointment basis.</Bullet>
            <Bullet>Roadside Assistance (RSA) services may be offered on an on-demand or emergency basis, subject to availability.</Bullet>
            <Bullet>The User acknowledges that service availability, response times, and completion timelines are not guaranteed and may vary due to external factors.</Bullet>
          </ul>

          <NumberedHeading number="5" title="Vehicle Handover and Inspection" />
          <Para>The User agrees to:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Hand over the Vehicle in a condition reasonably suitable for inspection or service</Bullet>
            <Bullet>Remove personal belongings and valuables from the Vehicle prior to service</Bullet>
            <Bullet>Inspect the Vehicle at the time of delivery or completion of service</Bullet>
          </ul>
          <Para>My FNG shall not be responsible for any personal items or valuables left in the Vehicle.</Para>

          <NumberedHeading number="6" title="Fair and Responsible Use" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Place false, duplicate, or fraudulent service requests</Bullet>
            <Bullet>Misuse Roadside Assistance services for non-emergency purposes or repeated unjustified requests</Bullet>
            <Bullet>Interfere with service providers, Platform operations, or customer support processes</Bullet>
            <Bullet>Harass, abuse, threaten, or behave inappropriately towards Partner Workshops, RSA Partners, or My FNG personnel</Bullet>
          </ul>

          <NumberedHeading number="7" title="Communication and Consent" />
          <Para>By using the Services, the User consents to receive communications from My FNG and its service partners, including calls, SMS messages, emails, and app notifications, for purposes related to:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Service coordination</Bullet>
            <Bullet>Booking confirmations</Bullet>
            <Bullet>Service updates and alerts</Bullet>
            <Bullet>Customer support and issue resolution</Bullet>
            <Bullet>Transactional communication</Bullet>
          </ul>

          <NumberedHeading number="8" title="Compliance with Instructions" />
          <Para>The User agrees to comply with all reasonable instructions, safety guidelines, and service-related directions communicated by My FNG, Partner Workshops, or RSA Partners during the course of service facilitation.</Para>

          <NumberedHeading number="9" title="Suspension for Misuse" />
          <Para>My FNG reserves the right to suspend, restrict, or terminate a User&apos;s access to the Platform or Services, with or without prior notice, in the event of:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Breach of these Terms</Bullet>
            <Bullet>Misuse or abuse of Services, including RSA misuse</Bullet>
            <Bullet>Non-payment of applicable Charges</Bullet>
            <Bullet>Conduct that poses legal, operational, reputational, or safety risks</Bullet>
          </ul>

          <NumberedHeading number="10" title="No Ownership or Rights in Services" />
          <Para>Use of the Platform or Services does not grant the User any ownership rights, intellectual property rights, or proprietary interest in the Platform, Content, or underlying systems, except for the limited right to access and use the Services in accordance with these Terms.</Para>
        </AccordionCard>

        {/* SUPPORT */}
        <AccordionCard defaultOpen title="Support" variant="bar">
          <NumberedHeading number="1" title="Scope of Support Services" />
          <Para>My FNG provides customer support to assist Users with matters relating to access to the Platform, service bookings, coordination with Partner Workshops or RSA Partners, and general queries regarding the Services facilitated through the Platform.</Para>
          <Para>Such support is provided strictly on a facilitative basis and does not constitute the provision, supervision, control, or guarantee of any automotive or roadside service.</Para>

          <NumberedHeading number="2" title="Modes of Support" />
          <Para>The Company offers email-based and phone-based support, along with an online knowledge repository of frequently asked questions (FAQs) available on the Platform.</Para>
          <Para>Support may be accessed through the following channels:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Email: support@myfng.in</Bullet>
            <Bullet>Helpline: +91-9152307030</Bullet>
            <Bullet>FAQs / Knowledge Base: Available on the Platform</Bullet>
          </ul>
          <Para>Support is generally available Monday to Sunday between 10:00 a.m. and 7:00 p.m. (IST), excluding public holidays, technical outages, or scheduled maintenance periods.</Para>

          <NumberedHeading number="3" title="Response and Availability" />
          <Para>While My FNG endeavors to respond to support requests in a timely manner, response times may vary depending on factors such as:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>the nature and complexity of the request</Bullet>
            <Bullet>service location</Bullet>
            <Bullet>availability of Partner Workshops or RSA Partners</Bullet>
            <Bullet>operational capacity and support workload</Bullet>
          </ul>
          <Para>My FNG does not guarantee resolution within any specific timeframe.</Para>

          <NumberedHeading number="4" title="Support Limitations" />
          <Para>The User acknowledges and agrees that:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>My FNG support does not replace or substitute the obligations of Partner Workshops or RSA Partners.</Bullet>
            <Bullet>Mechanical issues, service quality concerns, and execution-related matters remain the responsibility of the relevant third-party service provider.</Bullet>
            <Bullet>My FNG does not control the method, manner, or execution of services performed by third-party providers.</Bullet>
          </ul>

          <NumberedHeading number="5" title="Escalation and Facilitation" />
          <Para>Where appropriate, My FNG may facilitate communication or escalation of issues raised by the User with the relevant Partner Workshop or RSA Partner.</Para>
          <Para>Such facilitation shall not be construed as an admission of liability, responsibility, or operational control by My FNG.</Para>

          <NumberedHeading number="6" title="Accuracy of Information" />
          <Para>Any information, guidance, or assistance provided by My FNG support personnel is offered on a best-effort and informational basis only, based on details available at the time.</Para>
          <Para>Such information should not be considered technical, mechanical, or professional advice.</Para>

          <NumberedHeading number="7" title="Emergency and Roadside Situations" />
          <Para>My FNG support services are not emergency response services.</Para>
          <Para>For Roadside Assistance requests, facilitation is subject to:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>availability of service providers</Bullet>
            <Bullet>location accessibility</Bullet>
            <Bullet>operational feasibility</Bullet>
            <Bullet>third-party response capability</Bullet>
          </ul>
          <Para>My FNG does not guarantee immediate assistance or specific response times.</Para>

          <NumberedHeading number="8" title="User Conduct and Right to Refuse Support" />
          <Para>My FNG reserves the right to refuse, restrict, or discontinue support services where a User:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>engages in abusive, threatening, or inappropriate conduct</Bullet>
            <Bullet>submits false or misleading information</Bullet>
            <Bullet>repeatedly raises unreasonable, fraudulent, or frivolous requests</Bullet>
            <Bullet>misuses the Platform or support channels</Bullet>
          </ul>
        </AccordionCard>

        {/* PROHIBITED USAGE */}
        <AccordionCard defaultOpen title="Prohibited Usage of the Platform" variant="bar">
          <NumberedHeading number="1" title="Unlawful or Unauthorized Use" />
          <Para>The User shall not access or use the Platform or Services for any purpose that is unlawful, fraudulent, deceptive, malicious, or otherwise prohibited under Applicable Law or these Terms.</Para>
          <Para>Any use of the Platform in violation of statutory, regulatory, or contractual obligations is strictly prohibited.</Para>

          <NumberedHeading number="2" title="Misrepresentation and Fraud" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Impersonate Any Person Or Entity</Bullet>
            <Bullet>Misrepresent Identity, Vehicle Ownership, Service Requirements, Or Location</Bullet>
            <Bullet>Submit False, Misleading, Or Fabricated Information</Bullet>
            <Bullet>Initiate Fraudulent, Duplicate, Or Deceptive Service Requests</Bullet>
          </ul>

          <NumberedHeading number="3" title="Abuse of Services and RSA Misuse" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Misuse Or Repeatedly Abuse Roadside Assistance Services For Non-Emergency Situations</Bullet>
            <Bullet>Generate Service Requests Without Genuine Intent To Avail The Services</Bullet>
            <Bullet>Engage In Repeated Cancellations Or No-Shows Without Valid Justification</Bullet>
            <Bullet>Cause Unnecessary Dispatch Or Operational Disruption To Partner Workshops Or RSA Partners</Bullet>
          </ul>

          <NumberedHeading number="4" title="Interference with Platform Operations" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Attempt To Gain Unauthorized Access To The Platform, Servers, Databases, Or Systems</Bullet>
            <Bullet>Reverse Engineer, Decompile, Disassemble, Or Attempt To Derive Source Code</Bullet>
            <Bullet>Introduce Viruses, Malware, Or Any Harmful Code</Bullet>
            <Bullet>Disrupt, Interfere With, Or Compromise The Security, Integrity, Or Performance Of The Platform</Bullet>
          </ul>

          <NumberedHeading number="5" title="Misuse of Content and Intellectual Property" />
          <Para>The User shall not copy, reproduce, distribute, publish, modify, transmit, or commercially exploit any Content available on the Platform without the prior written consent of My FNG, except as expressly permitted under these Terms.</Para>

          <NumberedHeading number="6" title="Harassment and Inappropriate Conduct" />
          <Para>The User shall not engage in abusive, threatening, defamatory, obscene, discriminatory, or otherwise inappropriate conduct toward Partner Workshops, RSA Partners, My FNG employees, agents, support personnel, or other Users.</Para>

          <NumberedHeading number="7" title="Commercial Exploitation and Circumvention" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Use The Platform Or Services For Commercial Resale, Redistribution, Or Solicitation</Bullet>
            <Bullet>Harvest Or Extract Data, Contact Details, Or Pricing Information For Competitive Purposes</Bullet>
            <Bullet>Circumvent Pricing, Payment Mechanisms, Service Workflows, Or Platform Safeguards</Bullet>
          </ul>

          <NumberedHeading number="8" title="Preservation of Records and Lawful Disclosure" />
          <Para>In the event of a suspected violation of Applicable Law, these Terms, or the Privacy Policy, My FNG shall be entitled to preserve User-generated information and associated records for a minimum period of ninety (90) days, or for such longer period as may be required by law.</Para>

          <NumberedHeading number="9" title="Disclosure and Transfer of User Information" />
          <Para>My FNG may disclose, share, or transfer User-generated information:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>To Its Affiliates Or Service Partners Where Necessary For Service Facilitation</Bullet>
            <Bullet>To Governmental, Regulatory, Or Law Enforcement Authorities Where Required Or Permitted By Applicable Law</Bullet>
          </ul>
          <Para>The User expressly consents to such disclosure or transfer.</Para>

          <NumberedHeading number="10" title="Immediate Termination for Non-Compliance" />
          <Para>My FNG reserves the right to immediately suspend or terminate the User&apos;s access to the Platform or Services in the event of:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Violation Of Applicable Law</Bullet>
            <Bullet>Breach Of These Terms Or The Privacy Policy</Bullet>
            <Bullet>Conduct Posing Legal, Security, Or Operational Risks</Bullet>
          </ul>

          <NumberedHeading number="11" title="Consequences and Remedies" />
          <Para>My FNG may, at its sole discretion:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Cancel Pending Or Future Bookings</Bullet>
            <Bullet>Restrict Or Permanently Block Access To The Platform</Bullet>
            <Bullet>Recover Losses Or Damages Caused By The Violation</Bullet>
            <Bullet>Initiate Legal Proceedings Or Cooperate With Law Enforcement Authorities</Bullet>
          </ul>

          <NumberedHeading number="12" title="No Waiver" />
          <Para>Any failure or delay by My FNG in enforcing any provision of this section shall not be construed as a waiver of its right to enforce such provision at any subsequent time.</Para>
        </AccordionCard>

        {/* USER COMMENTS, FEEDBACK */}
        <AccordionCard defaultOpen title="User Comments, Feedback and Other Submissions" variant="bar">
          <NumberedHeading number="1" title="User Submissions" />
          <Para>The Platform may permit Users to submit reviews, ratings, comments, suggestions, feedback, images, messages, or other content in connection with the Services (&ldquo;User Submissions&rdquo;).</Para>
          <Para>By providing any User Submission, you represent and warrant that such content is accurate to the best of your knowledge and does not violate Applicable Law or the rights of any third party.</Para>

          <NumberedHeading number="2" title="Non-Confidential Nature of Submissions" />
          <Para>Unless expressly stated otherwise in writing, all User Submissions shall be deemed non-confidential and non-proprietary.</Para>

          <NumberedHeading number="3" title="License Grant" />
          <Para>By submitting User Submissions through the Platform, you grant My FNG a worldwide, irrevocable, perpetual, non-exclusive, royalty-free, transferable, and sublicensable license to use, host, store, reproduce, modify, adapt, publish, translate, distribute, publicly display, and otherwise exploit such User Submissions for purposes including service improvement, analytics, customer communication, and marketing.</Para>

          <NumberedHeading number="4" title="Moral Rights Waiver" />
          <Para>To the extent permitted under Applicable Law, you irrevocably waive any moral rights or similar rights in respect of your User Submissions.</Para>

          <NumberedHeading number="5" title="Content Standards" />
          <Para>You agree that User Submissions shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Be False, Misleading, Or Deceptive</Bullet>
            <Bullet>Be Defamatory, Abusive, Obscene, Or Offensive</Bullet>
            <Bullet>Infringe Intellectual Property, Privacy, Or Publicity Rights</Bullet>
            <Bullet>Contain Malware, Spam, Or Unauthorized Advertising</Bullet>
            <Bullet>Violate Applicable Law Or Platform Policies</Bullet>
          </ul>

          <NumberedHeading number="6" title="Monitoring and Removal" />
          <Para>My FNG reserves the right to review, monitor, edit, restrict, or remove any User Submissions at its sole discretion, without prior notice.</Para>

          <NumberedHeading number="7" title="No Endorsement" />
          <Para>User Submissions reflect the opinions of the individual Users and do not represent the views or guarantees of My FNG.</Para>

          <NumberedHeading number="8" title="Responsibility for Submissions" />
          <Para>You remain solely responsible for all User Submissions you provide and for any consequences arising from them.</Para>

          <NumberedHeading number="9" title="Use in Legal or Regulatory Proceedings" />
          <Para>My FNG may reserve and disclose User Submissions and associated records where required by Applicable Law, legal process, or governmental authorities.</Para>
        </AccordionCard>

        {/* USER DATA */}
        <AccordionCard defaultOpen title="User Data" variant="bar">
          <NumberedHeading number="1" title="Accuracy and Responsibility for User Data" />
          <Para>The User represents and warrants that all information provided (&ldquo;User Data&rdquo;) is true, accurate, current, and complete. The User undertakes to maintain and promptly update such information.</Para>
          <Para>My FNG reserves the right to suspend or terminate access if User Data is found to be false, misleading, outdated, or incomplete.</Para>

          <NumberedHeading number="2" title="Collection and Processing of User Data" />
          <Para>My FNG may collect, receive, store, and process User Data for lawful purposes including:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Facilitating Service Bookings And Roadside Assistance Requests</Bullet>
            <Bullet>Verifying And Validating Documents Or Service-Related Information</Bullet>
            <Bullet>Coordinating With Partner Workshops, RSA Partners, And Other Service Providers</Bullet>
            <Bullet>Communicating Service Updates, Confirmations, And Support Information</Bullet>
            <Bullet>Processing Payments, Refunds, And Transaction Records</Bullet>
            <Bullet>Ensuring Platform Security, Fraud Prevention, And Legal Compliance</Bullet>
          </ul>

          <NumberedHeading number="3" title="Analytics and Platform Improvement" />
          <Para>My FNG may use User Data for analytics, trend identification, statistical analysis, and operational insights to improve the Platform.</Para>

          <NumberedHeading number="4" title="User Consent" />
          <Para>By accessing or using the Platform, the User expressly consents to the collection, use, storage, processing, and sharing of User Data as described in these Terms and the Privacy Policy.</Para>

          <NumberedHeading number="5" title="Sharing and Disclosure of User Data" />
          <Para>My FNG may disclose or share User Data:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>With Partner Workshops, RSA Partners, Payment Gateways, and other Service Providers</Bullet>
            <Bullet>With Affiliates Or Group Companies for operational or compliance purposes</Bullet>
            <Bullet>With Governmental Authorities or Law Enforcement Agencies where required by Applicable Law</Bullet>
          </ul>

          <NumberedHeading number="6" title="Cross-Border and Third-Party Transfers" />
          <Para>My FNG may transfer User Data to entities within India or abroad, provided such entities maintain comparable data protection standards.</Para>

          <NumberedHeading number="7" title="Data Retention" />
          <Para>User Data shall be retained only for such period as is reasonably necessary to fulfill stated purposes, comply with legal requirements, resolve disputes, and meet legitimate business needs.</Para>

          <NumberedHeading number="8" title="Data Security" />
          <Para>My FNG implements reasonable technical and organizational security measures. However, no system can be completely secure.</Para>

          <NumberedHeading number="9" title="User Rights" />
          <Para>Subject to Applicable Law, the User may have the right to:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Access and review User Data</Bullet>
            <Bullet>Correct inaccurate information</Bullet>
            <Bullet>Request deletion of User Data</Bullet>
            <Bullet>Withdraw consent for certain processing activities</Bullet>
          </ul>

          <NumberedHeading number="10" title="Governing Policy" />
          <Para>The collection and protection of User Data are further governed by My FNG&apos;s Privacy Policy, which forms an integral part of these Terms.</Para>
        </AccordionCard>

        <AccordionCard defaultOpen title="Data Protection (DPDP Act, 2023)" variant="bar">
          <NumberedHeading number="1" title="Role of the Parties" />
          <Para>
            MY FNG Autocare Private Limited is a Data Fiduciary for personal data processed to operate the
            Platform. Partner workshops and certain processors act as Data Processors or independent Data
            Fiduciaries for work they perform themselves.
          </Para>
          <NumberedHeading number="2" title="Lawful Purpose and Consent" />
          <Para>
            Personal data is processed to perform a service the User requested, to comply with law, or on
            consent that is free, specific, informed, and unambiguous. Optional purposes (promotional
            messages, analytics cookies, advertising cookies) require a separate, unticked opt-in.
            Withdrawal of consent does not affect processing already completed or processing required by law.
          </Para>
          <NumberedHeading number="3" title="Notice and Rights" />
          <Para>
            The Privacy Notice and Privacy Policy describe what data is collected, why, retention, and
            third parties. The User may access, correct, erase (where permitted), withdraw consent, nominate
            another person, and raise a grievance via the data-rights form or the Grievance Officer
            (cs-reply@myfng.in).
          </Para>
          <NumberedHeading number="4" title="Security and Breach" />
          <Para>
            MY FNG shall implement reasonable security safeguards. In a personal data breach, MY FNG will
            follow its internal breach runbook, including notice to the Data Protection Board of India and
            affected Data Principals as required under applicable law (including the 72-hour Board notice
            standard when it applies).
          </Para>
          <NumberedHeading number="5" title="Processors and Cross-Border Transfer" />
          <Para>
            Processors (hosting, payments, messaging, maps, telephony) may process data in or outside India
            under contracts that require confidentiality and comparable protection.
          </Para>
        </AccordionCard>

        {/* INTELLECTUAL PROPERTY RIGHTS */}
        <AccordionCard defaultOpen title="Intellectual Property Rights" variant="bar">
          <NumberedHeading number="1" title="Ownership of Intellectual Property" />
          <Para>All intellectual property rights in and to the Platform (&ldquo;Platform IP&rdquo;) are owned by or lawfully licensed to My FNG Autocare Private Limited.</Para>

          <NumberedHeading number="2" title="Protection of Rights" />
          <Para>The Platform IP is protected under applicable intellectual property laws. No rights are transferred to the User except as expressly provided.</Para>

          <NumberedHeading number="3" title="Limited Right of Use" />
          <Para>My FNG grants the User a limited, revocable, non-exclusive, non-transferable right to access and use the Platform solely for personal and lawful use.</Para>

          <NumberedHeading number="4" title="Restrictions" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Copy, Reproduce, Modify, Or Create Derivative Works From The Platform</Bullet>
            <Bullet>Reverse Engineer, Decompile, Or Extract Source Code</Bullet>
            <Bullet>Remove Or Obscure Any Copyright Or Trademark Notices</Bullet>
            <Bullet>Use The Company&apos;s Branding Without Written Consent</Bullet>
            <Bullet>Use The Platform For Any Commercial Purpose Unless Authorized</Bullet>
          </ul>

          <NumberedHeading number="5" title="User Submissions and Feedback" />
          <Para>Any feedback submitted shall not confer ownership rights on the User and shall be governed by the User Submissions clause.</Para>

          <NumberedHeading number="6" title="Third-Party Intellectual Property" />
          <Para>Third-party intellectual property remains the property of its respective owners.</Para>

          <NumberedHeading number="7" title="Enforcement and Remedies" />
          <Para>Unauthorized use of Platform IP may result in immediate suspension and civil or criminal remedies under Applicable Law.</Para>

          <NumberedHeading number="8" title="No Waiver" />
          <Para>Failure to enforce IP rights shall not constitute a waiver.</Para>
        </AccordionCard>

        {/* USER CONTENT AND FEEDBACK */}
        <AccordionCard defaultOpen title="User Content and Feedback" variant="bar">
          <Para>By submitting reviews, ratings, comments, images, feedback, or other content (&ldquo;User Content&rdquo;), the User grants My FNG a worldwide, non-exclusive, royalty-free, transferable license to use, reproduce, modify, publish, display, and distribute such User Content for operating, improving, and promoting the Platform and Services. The User represents that they own or have the necessary rights to submit such content.</Para>
        </AccordionCard>

        {/* LICENSE */}
        <AccordionCard defaultOpen title="License" variant="bar">
          <NumberedHeading number="1" title="Grant of License" />
          <Para>My FNG grants the User a limited, non-exclusive, non-transferable, non-sublicensable, and revocable license to access and use the Platform and its content for availing the Services.</Para>

          <NumberedHeading number="2" title="Scope and Purpose" />
          <Para>The License is provided solely for personal and non-commercial use.</Para>

          <NumberedHeading number="3" title="Restrictions on Use" />
          <Para>The User shall not:</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Copy, Reproduce, Or Create Derivative Works</Bullet>
            <Bullet>Distribute, Sell, Or Otherwise Exploit The Platform</Bullet>
            <Bullet>Publicly Display Or Broadcast Any Part Of The Platform</Bullet>
            <Bullet>Circumvent Security Features Or Access Controls</Bullet>
            <Bullet>Use The Platform For Unlawful Or Competitive Purposes</Bullet>
          </ul>

          <NumberedHeading number="4" title="No Implied Rights" />
          <Para>No licenses or rights are granted by implication except as expressly stated.</Para>

          <NumberedHeading number="5" title="Ownership" />
          <Para>The Platform and all IP rights remain the exclusive property of My FNG.</Para>

          <NumberedHeading number="6" title="Termination of License" />
          <Para>This License terminates automatically upon breach, suspension, or discontinuation of the Platform.</Para>

          <NumberedHeading number="7" title="Survival" />
          <Para>Provisions relating to IP Rights, Limitation of Liability, Indemnification, and Governing Law survive termination.</Para>
        </AccordionCard>

        {/* THIRD-PARTY PLATFORM DISTRIBUTION */}
        <AccordionCard defaultOpen title="Third-Party Platform Distribution" variant="bar">
          <Para>The Platform may be made available through third-party distribution platforms such as mobile application stores. The User acknowledges that such platforms may have their own terms. My FNG is not responsible for their policies or practices.</Para>
        </AccordionCard>

        {/* LIMITATION OF LIABILITY */}
        <AccordionCard defaultOpen title="Limitation of Liability" variant="bar">
          <NumberedHeading number="1" title="Platform-as-a-Facilitator Disclaimer" />
          <Para>My FNG operates solely as a technology-enabled facilitation platform. All automotive services are performed by independent Partner Workshops or RSA Partners.</Para>

          <NumberedHeading number="2" title="No Warranties or Guarantees" />
          <Para>The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of merchantability, fitness, accuracy, availability, or uninterrupted operation.</Para>

          <NumberedHeading number="3" title="Exclusion of Certain Damages" />
          <Para>My FNG shall not be liable for any indirect, incidental, special, consequential, or punitive damages including loss of profits, business, data, goodwill, or use of the Vehicle.</Para>

          <NumberedHeading number="4" title="Third-Party Service Risks" />
          <Para>My FNG shall not be liable for quality, delays, cancellation, or damages related to services by Partner Workshops or RSA Partners.</Para>

          <NumberedHeading number="5" title="Platform and Technical Limitations" />
          <Para>My FNG shall not be responsible for losses from platform downtime, technical failures, network issues, or cyber incidents beyond reasonable control.</Para>

          <NumberedHeading number="6" title="Aggregate Liability Cap" />
          <Para>Total aggregate liability shall not exceed the facilitation fee paid for the specific Service, or INR 1,000, whichever is lower.</Para>

          <NumberedHeading number="7" title="User Responsibility and Assumption of Risk" />
          <Para>The User voluntarily assumes all risks associated with automotive and roadside services.</Para>

          <NumberedHeading number="8" title="Mandatory Legal Rights" />
          <Para>Nothing in these Terms shall exclude liability that cannot be excluded under Applicable Law.</Para>
        </AccordionCard>

        {/* EXEMPTIONS TO LIABILITY */}
        <AccordionCard defaultOpen title="Exemptions to Liability of the Company" variant="bar">
          <Para>My FNG shall not be liable for losses arising from:</Para>

          <NumberedHeading number="1" title="Acts or Omissions of Third-Party Service Providers" />
          <Para>Including workmanship quality, service outcomes, spare parts, or service timelines.</Para>

          <NumberedHeading number="2" title="Vehicle Condition and Pre-Existing Issues" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Pre-existing issues, normal wear and tear, or manufacturer defects</Bullet>
            <Bullet>Damage from prior repairs, modifications, or improper maintenance</Bullet>
            <Bullet>Issues not reasonably detectable beforehand</Bullet>
          </ul>

          <NumberedHeading number="3" title="Roadside Assistance and Emergency Services" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Delays or non-availability of RSA services</Bullet>
            <Bullet>Route selection or handling decisions by towing operators</Bullet>
            <Bullet>Damage during towing, jump-start, fuel delivery, or on-road assistance</Bullet>
          </ul>

          <NumberedHeading number="4" title="Force Majeure Events" />
          <Para>Natural disasters, floods, fires, strikes, pandemics, government actions, power failures, network outages, or acts of God.</Para>

          <NumberedHeading number="5" title="User Actions or Negligence" />
          <Para>Incorrect information, failure to follow instructions, unauthorized repairs, or improper use of the Vehicle after service.</Para>

          <NumberedHeading number="6" title="Personal Belongings and Valuables" />
          <Para>My FNG shall not be responsible for loss, theft, or damage to items left inside the Vehicle.</Para>

          <NumberedHeading number="7" title="Pricing Variations and Additional Repairs" />
          <Para>Changes in costs due to additional repairs, spare part price fluctuations, or user-approved additional services.</Para>

          <NumberedHeading number="8" title="Platform and Technical Issues" />
          <Para>Temporary unavailability, technical malfunctions, connectivity issues, or data loss beyond reasonable controls.</Para>

          <NumberedHeading number="9" title="No Guarantee of Outcomes" />
          <Para>Failure to achieve expected performance improvements, recurrence of issues, or consequential damages from service outcomes.</Para>

          <NumberedHeading number="10" title="Lawful Acts and Compliance Obligations" />
          <Para>Actions taken in good faith to comply with Applicable Law, court orders, or regulatory requirements.</Para>

          <NumberedHeading number="11" title="Statutory Rights" />
          <Para>Nothing shall exclude or limit liability where not permitted under Applicable Law.</Para>
        </AccordionCard>

        {/* BILLING / CHARGES */}
        <AccordionCard defaultOpen title="Billing / Charges" variant="bar">
          <NumberedHeading number="1" title="Service Charges and Pricing Structure" />
          <Para>Charges may include service fees, labour, inspection charges, facilitation fees, spare parts, towing, taxes, and other levies.</Para>

          <NumberedHeading number="2" title="Indicative Pricing and Estimates" />
          <Para>Prices shown are indicative. Final Charges may vary based on vehicle condition, additional repairs, spare parts, location, and taxes.</Para>

          <NumberedHeading number="3" title="Service Packages" />
          <Para>Work outside the scope of a selected Service Package shall be treated as Additional Services and billed separately.</Para>

          <NumberedHeading number="4" title="Roadside Assistance and Towing Charges" />
          <Para>RSA services may be charged based on distance, time, location, vehicle type, and complexity.</Para>

          <NumberedHeading number="5" title="Taxes and Statutory Levies" />
          <Para>All Charges are exclusive of applicable taxes unless expressly stated otherwise.</Para>

          <NumberedHeading number="6" title="Payment Methods" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Digital payment gateways</Bullet>
            <Bullet>UPI</Bullet>
            <Bullet>Credit or debit cards</Bullet>
            <Bullet>Net banking</Bullet>
            <Bullet>Other permitted payment methods</Bullet>
          </ul>

          <NumberedHeading number="7" title="Payment Authorization" />
          <Para>By confirming a Booking, the User authorizes My FNG to charge the applicable amount through the selected payment method.</Para>

          <NumberedHeading number="8" title="Non-Payment or Payment Failure" />
          <Para>My FNG may suspend or cancel bookings, withhold delivery, or recover outstanding amounts through lawful means.</Para>

          <NumberedHeading number="9" title="Invoices and Billing Records" />
          <Para>Invoices may be generated electronically. The User is responsible for reviewing billing details promptly.</Para>

          <NumberedHeading number="10" title="Price Revisions" />
          <Para>My FNG may revise pricing at any time for future Bookings. Changes shall not affect already confirmed Bookings.</Para>

          <NumberedHeading number="11" title="No Hidden Charges" />
          <Para>No Charges shall be levied without disclosure or User approval, except where required by law.</Para>
        </AccordionCard>

        {/* CANCELLATION AND REFUND */}
        <AccordionCard defaultOpen title="Cancellation and Refund" variant="bar">
          <NumberedHeading number="1" title="Cancellation by User" />
          <Para>Cancellation requests shall be effective only upon confirmation by My FNG.</Para>

          <NumberedHeading number="2" title="Cancellation Before Service Commencement" />
          <Para>The User may be eligible for a refund, subject to deduction of applicable charges.</Para>

          <NumberedHeading number="3" title="Cancellation After Service Commencement" />
          <Para>No refunds where service has commenced, a provider has arrived, or parts have been procured.</Para>

          <NumberedHeading number="4" title="Roadside Assistance and Emergency Services" />
          <Para>No refunds once the service provider has been dispatched, irrespective of whether the service is ultimately availed.</Para>

          <NumberedHeading number="5" title="Cancellation by My FNG" />
          <Para>My FNG may cancel due to unavailability, inaccurate information, safety concerns, or non-payment.</Para>

          <NumberedHeading number="6" title="Refund Eligibility and Mode" />
          <Para>Refunds processed through the original payment method. My FNG does not offer cash refunds.</Para>

          <NumberedHeading number="7" title="Refund Timelines" />
          <Para>Approved refunds processed within a reasonable period. Delays by banks are not My FNG&apos;s responsibility.</Para>

          <NumberedHeading number="8" title="Non-Refundable Amounts" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Inspection, Diagnostic, Or Visit Charges</Bullet>
            <Bullet>Towing Or RSA Dispatch Charges</Bullet>
            <Bullet>Charges For Additional Services Approved By The User</Bullet>
            <Bullet>Charges Due To User&apos;s Absence Or Incorrect Information</Bullet>
          </ul>

          <NumberedHeading number="9" title="Disputes and Clarifications" />
          <Para>Disputes must be raised within a reasonable time. My FNG will review on a best-effort basis.</Para>

          <NumberedHeading number="10" title="No Guarantee of Refund" />
          <Para>Refunds are not guaranteed. My FNG&apos;s decision shall be final, subject to Applicable Law.</Para>

          <NumberedHeading number="11" title="Statutory Rights" />
          <Para>Statutory rights that cannot be lawfully excluded are preserved.</Para>
        </AccordionCard>

        {/* DISPUTE RESOLUTION */}
        <AccordionCard defaultOpen title="Dispute Resolution" variant="bar">
          <NumberedHeading number="1" title="Good Faith Resolution" />
          <Para>The User and My FNG shall first attempt to resolve Disputes amicably through mutual discussions.</Para>

          <NumberedHeading number="2" title="Escalation and Internal Review" />
          <Para>My FNG may internally review and facilitate further communication. Such facilitation is not an admission of liability.</Para>

          <NumberedHeading number="3" title="Arbitration" />
          <Para>Unresolved Disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.</Para>
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Sole arbitrator appointed by My FNG</Bullet>
            <Bullet>Seat and venue: Thane, Maharashtra, India</Bullet>
            <Bullet>Language: English</Bullet>
          </ul>

          <NumberedHeading number="4" title="Jurisdiction for Non-Arbitrable Matters" />
          <Para>Exclusive jurisdiction of courts in Thane, Maharashtra, India.</Para>

          <NumberedHeading number="5" title="Interim and Injunctive Relief" />
          <Para>My FNG may seek interim relief to protect IP rights, confidential information, and platform security.</Para>

          <NumberedHeading number="6" title="Continued Use of Services" />
          <Para>During any Dispute, the User agrees to continue complying with these Terms.</Para>

          <NumberedHeading number="7" title="Costs" />
          <Para>Each party bears its own costs unless otherwise determined by the arbitrator.</Para>

          <NumberedHeading number="8" title="Statutory Rights" />
          <Para>Statutory rights that cannot be lawfully waived are preserved.</Para>
        </AccordionCard>

        {/* GOVERNING LAW */}
        <AccordionCard defaultOpen title="Governing Law" variant="bar">
          <Para>These Terms shall be governed by the laws of India. Competent courts in Thane, Maharashtra, India shall have exclusive jurisdiction, subject to Applicable Law.</Para>
        </AccordionCard>

        {/* MODIFICATION OF TERMS */}
        <AccordionCard defaultOpen title="Modification of Terms" variant="bar">
          <Para>My FNG may modify these Terms at any time. Updated versions will be published with a revised &ldquo;Effective Date.&rdquo; Continued use constitutes acceptance. If you disagree, discontinue use.</Para>
        </AccordionCard>

        {/* GENERAL PROVISIONS */}
        <AccordionCard defaultOpen title="General Provisions" variant="bar">
          <NumberedHeading number="1" title="Entire Agreement" />
          <Para>These Terms and Privacy Policy constitute the entire agreement, superseding all prior understandings.</Para>

          <NumberedHeading number="2" title="Severability" />
          <Para>Invalid provisions shall be severed; remaining provisions remain in full force.</Para>

          <NumberedHeading number="3" title="No Waiver" />
          <Para>Failure to enforce any right shall not constitute a waiver.</Para>

          <NumberedHeading number="4" title="Assignment" />
          <Para>The User shall not assign rights without written consent. My FNG may freely assign.</Para>

          <NumberedHeading number="5" title="Relationship of Parties" />
          <Para>No partnership, joint venture, agency, or employment relationship is created. My FNG acts solely as an independent facilitator.</Para>

          <NumberedHeading number="6" title="Force Majeure" />
          <Para>My FNG is not liable for delays due to acts of God, natural disasters, pandemics, strikes, government actions, network failures, power outages, or technical breakdowns.</Para>

          <NumberedHeading number="7" title="Survival" />
          <Para>IP Rights, License Restrictions, Limitation of Liability, Indemnification, Dispute Resolution, and Governing Law survive termination.</Para>

          <NumberedHeading number="8" title="Headings" />
          <Para>Headings are for convenience only and do not affect interpretation.</Para>

          <NumberedHeading number="9" title="Electronic Records and Communication" />
          <Para>These Terms are an electronic record under the IT Act, 2000. Electronic communications have the same legal effect as written ones.</Para>

          <NumberedHeading number="10" title="Interpretation" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Singular includes plural and vice versa</Bullet>
            <Bullet>&ldquo;Including&rdquo; means &ldquo;including without limitation&rdquo;</Bullet>
            <Bullet>Statute references include amendments and replacements</Bullet>
          </ul>
        </AccordionCard>

        {/* TERMINATION */}
        <AccordionCard defaultOpen title="Termination" variant="bar">
          <NumberedHeading number="1" title="Termination by User" />
          <Para>The User may discontinue use at any time. Active bookings and payment obligations survive termination.</Para>

          <NumberedHeading number="2" title="Termination or Suspension by My FNG" />
          <Para>My FNG may suspend or terminate access for breaches, false information, fraudulent conduct, security risks, or as required by law.</Para>

          <NumberedHeading number="3" title="Immediate Termination" />
          <Para>Immediate termination without notice for conduct causing harm, RSA misuse, or IP infringement.</Para>

          <NumberedHeading number="4" title="Effect of Termination" />
          <ul className="space-y-3 mb-5 ml-1">
            <Bullet>Access rights immediately cease</Bullet>
            <Bullet>Pending bookings may be cancelled</Bullet>
            <Bullet>Outstanding Charges become immediately payable</Bullet>
            <Bullet>License automatically terminates</Bullet>
          </ul>

          <NumberedHeading number="5" title="No Liability for Termination" />
          <Para>My FNG shall not be liable for losses from suspension or termination in accordance with these Terms.</Para>

          <NumberedHeading number="6" title="Survival of Rights and Obligations" />
          <Para>IP Rights, Limitation of Liability, Indemnification, Dispute Resolution, and Governing Law survive termination.</Para>

          <NumberedHeading number="7" title="Re-Registration" />
          <Para>Termination does not obligate My FNG to permit re-registration.</Para>
        </AccordionCard>

        {/* INDEMNIFICATION */}
        <AccordionCard defaultOpen title="Indemnification" variant="bar">
          <Para>The User agrees to indemnify and hold harmless My FNG from all claims, losses, and expenses arising from:</Para>

          <NumberedHeading number="1" title="Breach of Terms" />
          <Para>Any breach of these Terms, Privacy Policy, or applicable policies.</Para>

          <NumberedHeading number="2" title="Violation of Law" />
          <Para>Any violation of Applicable Law by the User.</Para>

          <NumberedHeading number="3" title="Misuse of the Platform or Services" />
          <Para>Any misuse, abuse, or fraudulent activity including RSA misuse.</Para>

          <NumberedHeading number="4" title="User Data and Submissions" />
          <Para>Claims from inaccurate information, submissions, or IP infringement by the User.</Para>

          <NumberedHeading number="5" title="Third-Party Interactions" />
          <Para>Disputes from interaction with Partner Workshops, RSA Partners, or other service providers.</Para>

          <NumberedHeading number="6" title="Negligence or Misconduct" />
          <Para>Any negligent act or willful misconduct by the User.</Para>

          <NumberedHeading number="7" title="Defense and Cooperation" />
          <Para>My FNG may assume exclusive defense and the User agrees to cooperate.</Para>

          <NumberedHeading number="8" title="Survival" />
          <Para>This Indemnification clause survives termination of these Terms.</Para>
        </AccordionCard>

        {/* SUPPORT / CONTACTING US */}
        <AccordionCard defaultOpen title="Support / Contacting Us" variant="bar">
          <NumberedHeading number="1" title="Scope of Support Services" />
          <Para>My FNG provides facilitative customer support for Platform access, bookings, coordination, and general queries.</Para>

          <NumberedHeading number="2" title="Modes of Support" />
          <div className="mt-3 bg-blue-50 rounded-xl p-4 space-y-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600" />
        </div>
              <div>
                <p className="text-xs text-gray-500">Customer Support Helpline</p>
                <p className="text-sm font-semibold text-gray-900">+91-9152307030</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-semibold text-gray-900">support@myfng.in</p>
              </div>
            </div>
          </div>
          <Para>Support available Monday to Saturday, 10:00 a.m. to 7:00 p.m. (IST).</Para>

          <NumberedHeading number="3" title="Response and Availability" />
          <Para>Response times vary. My FNG does not guarantee resolution within any specific timeframe.</Para>

          <NumberedHeading number="4" title="Support Limitations" />
          <Para>My FNG support does not substitute Partner Workshop obligations. Execution-related issues remain with third-party providers.</Para>

          <NumberedHeading number="5" title="Escalation and Facilitation" />
          <Para>My FNG may facilitate escalation; this is not an admission of liability.</Para>

          <NumberedHeading number="6" title="Grievance Redressal Officer" />
          <div className="mt-3 bg-blue-50 rounded-xl p-4 space-y-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="text-sm font-semibold text-gray-900">Nitish Jha</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Mobile</p>
                <p className="text-sm font-semibold text-gray-900">+91-7977118621</p>
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
          </div>

          <NumberedHeading number="7" title="Accuracy of Information" />
          <Para>Support information is offered on a best-effort basis and should not be treated as professional advice.</Para>

          <NumberedHeading number="8" title="Emergency and Roadside Situations" />
          <Para>My FNG support is not an emergency response service. RSA facilitation is subject to availability.</Para>

          <NumberedHeading number="9" title="User Conduct and Right to Refuse Support" />
          <Para>My FNG may refuse support for abusive conduct, false information, or frivolous requests.</Para>
        </AccordionCard>

        {/* Closing */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 bg-gray-100 rounded-xl px-4 py-3 inline-block">
            By using the Platform and Services, you acknowledge and agree to these Terms and Conditions.
          </p>
        </div>

        <div className="h-8" />
      </div>
    </main>
      <Footer />
    </>
  );
}
