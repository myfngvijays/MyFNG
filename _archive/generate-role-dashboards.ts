/**
 * Template Generator for Remaining Role Dashboards
 * This script can generate dashboards for all remaining roles
 * Run this manually when needed to create missing role pages
 */

const remainingRoles = [
  { code: 'sub_admin', name: 'Sub Admin', features: ['Manage Department', 'View Reports', 'Oversee Operations'] },
  { code: 'rsa_manager', name: 'RSA Manager', features: ['RSA Leads', 'Assign Mechanics', 'Track Emergency Services'] },
  { code: 'home_service_manager', name: 'Home Service Manager', features: ['Home Service Leads', 'Assign Vans', 'Schedule Services'] },
  { code: 'telecaller', name: 'Telecaller', features: ['Call Customers', 'Follow-up', 'Update CRM'] },
  { code: 'customer_service_executive', name: 'Customer Service Executive', features: ['Handle Support', 'Manage Complaints', 'Customer Updates'] },
  { code: 'auditor', name: 'Auditor', features: ['Workshop Audits', 'Score Workshops', 'Quality Reports'] },
  { code: 'accounts_team', name: 'Accounts Team', features: ['Invoices', 'Payments', 'Financial Reports'] },
  { code: 'workshop_supervisor', name: 'Workshop Supervisor', features: ['Assign Jobs', 'Manage Mechanics', 'Track Progress'] },
  { code: 'company_mechanic_rsa', name: 'Company Mechanic (RSA)', features: ['RSA Jobs', 'On-field Repairs', 'Update Status'] },
  { code: 'company_van_technician', name: 'Company Van Technician', features: ['Home Service Jobs', 'At-home Repairs', 'Customer Service'] },
  { code: 'company_van_driver', name: 'Company Van Driver', features: ['Drive Service Vans', 'Assist Technician', 'Navigate Routes'] },
  { code: 'customer', name: 'Customer', features: ['Book Services', 'Track Vehicle', 'View History'] },
];

function generateDashboardTemplate(role: typeof remainingRoles[0]) {
  return `import DashboardLayout from '@/components/DashboardLayout';
import { DashboardCard, StatsGrid } from '@/components/RoleDashboards';
import { Activity, FileText, CheckCircle, Clock } from 'lucide-react';

export default function ${role.name.replace(/\s+/g, '')}Dashboard() {
  const stats = [
    { label: 'Total', value: '0', icon: <Activity className="w-8 h-8" />, color: 'text-brand-primary' },
    { label: 'Active', value: '0', icon: <FileText className="w-8 h-8" />, color: 'text-blue-500' },
    { label: 'Completed', value: '0', icon: <CheckCircle className="w-8 h-8" />, color: 'text-green-500' },
    { label: 'Pending', value: '0', icon: <Clock className="w-8 h-8" />, color: 'text-yellow-500' },
  ];

  return (
    <DashboardLayout role="${role.code}">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">${role.name} Dashboard</h1>
          <p className="text-text-body mt-2">Your personalized dashboard</p>
        </div>

        <StatsGrid stats={stats} />

        <DashboardCard title="Key Features">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${role.features.map(f => `<div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">${f}</h3>
              <p className="text-sm text-gray-600">Manage and track ${f.toLowerCase()}</p>
            </div>`).join('\n            ')}
          </div>
        </DashboardCard>

        <DashboardCard title="Recent Activity">
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}
`;
}

// Generate all dashboards
remainingRoles.forEach(role => {
  const content = generateDashboardTemplate(role);
  console.log(`\n=== ${role.code}/page.tsx ===\n`);
  console.log(content);
});

export {};

