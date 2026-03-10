export const metadata = {
  title: 'Privacy Policy | MyFNG',
  description: 'MyFNG Privacy Policy',
};

const PRIVACY_CONTENT = `MyFNG Privacy Policy

Last updated: February 27, 2026

This Privacy Policy describes how MyFNG Autocare Private Limited ("MyFNG", "Company", "we", "us", "our") collects, uses, stores, shares, and protects personal data when you use our website, mobile application, and related services (collectively, the "Platform" and "Services").

By accessing or using the Platform, you consent to the practices described in this Privacy Policy, subject to applicable law.

1. Information We Collect
We may collect the following categories of information:
- Identity details: name, phone number, email address
- Vehicle details: registration number, model, service history, fuel type
- Service and booking data: selected services, appointment details, workshop interactions, support records
- Location data: pickup/drop or breakdown location (where required for service fulfillment)
- Device and technical data: IP address, device type, browser/app version, logs, diagnostics
- Payment-related data: payment status, transaction references (handled via payment partners)
- Communication data: call records, chat/email exchanges, feedback, and grievances

2. How We Use Information
We use collected information to:
- Create and manage your account
- Facilitate bookings, roadside assistance, and service coordination
- Connect you with partner workshops and service providers
- Send confirmations, updates, invoices, and support communications
- Process payments, refunds, and billing disputes
- Prevent fraud, abuse, and misuse of services
- Improve platform quality, reliability, and user experience
- Comply with legal and regulatory obligations

3. Legal Basis and Consent
Where required by law, we process personal data based on:
- Your consent
- Performance of a contract/service request
- Compliance with legal obligations
- Legitimate business interests, where permitted

4. Sharing of Information
We may share data on a need-to-know basis with:
- Partner workshops, RSA/towing partners, and service personnel
- Payment gateways and banking partners
- Cloud, analytics, customer-support, and IT service providers
- Affiliates/group entities for operational purposes
- Government, regulatory, or law-enforcement authorities when required by law

We do not sell your personal data.

5. Cross-Border Transfer
Where operationally required and legally permitted, data may be processed or stored outside your state/country through approved vendors, subject to appropriate safeguards and comparable protection standards.

6. Data Retention
We retain personal data only for as long as necessary for:
- Service delivery and support
- Legal, tax, audit, and compliance requirements
- Dispute resolution and enforcement of terms

Retention periods may vary by data type and legal requirements.

7. Data Security
We implement reasonable technical and organizational safeguards to protect data against unauthorized access, misuse, alteration, loss, or disclosure. However, no platform can guarantee absolute security.

8. Your Rights
Subject to applicable law, you may have rights to:
- Access and review your personal data
- Request correction of inaccurate or outdated data
- Request deletion (where legally permissible)
- Withdraw consent for specific processing activities
- Raise concerns about misuse of personal data

To exercise rights, contact us using the details in the Contact section.

9. Cookies and Similar Technologies
We may use cookies and similar technologies for session management, analytics, performance, and user experience improvements. You may control cookies through browser settings; disabling some cookies may affect platform functionality.

10. Third-Party Links and Services
The Platform may contain links to third-party websites/services. Their privacy practices are governed by their own policies, and we are not responsible for their content or handling practices.

11. Children's Privacy
Our services are intended for users who are legally capable of entering into contracts (generally 18+). We do not knowingly collect personal data from children.

12. Policy Updates
We may revise this Privacy Policy from time to time to reflect business, technical, legal, or regulatory changes. Updated versions will be posted on the Platform with the revised effective date.

13. Contact and Grievance
For privacy queries, data requests, or grievances, contact:
- Email: info@myfng.in
- Customer Support: +91-9152307030
- Grievance Officer: Nitish Jha
- Grievance Contact: +91-7977118621

If you do not agree with this Privacy Policy, please discontinue use of the Platform and Services.
`;

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: February 27, 2026</p>
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-6">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-gray-800">
            {PRIVACY_CONTENT}
          </pre>
        </div>
      </div>
    </main>
  );
}
