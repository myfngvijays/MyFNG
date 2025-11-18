/**
 * Reusable Dashboard Components for All Roles
 * This file contains templates that can be used across different role dashboards
 */

import { ReactNode } from 'react';
import { CheckCircle, Clock, TrendingUp, AlertCircle } from 'lucide-react';

// Generic Dashboard Card Component
export function DashboardCard({
  title,
  children,
  className = '',
  headerAction,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}) {
  return (
    <div className={`card ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {headerAction}
      </div>
      {children}
    </div>
  );
}

// Stats Overview Component
export function StatsGrid({ stats }: { stats: { label: string; value: string | number; icon: ReactNode; color: string }[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="card hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </div>
            <div className={stat.color}>{stat.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Lead/Task List Item Component
export function ListItem({
  title,
  subtitle,
  metadata,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  metadata?: string[];
  badge?: { label: string; color: string };
  actions?: ReactNode;
}) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          {metadata && (
            <div className="flex flex-wrap gap-2 mt-2">
              {metadata.map((item, idx) => (
                <span key={idx} className="text-xs text-gray-500">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
        {badge && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </div>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}

// Empty State Component
export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      {action}
    </div>
  );
}

// Badge Color Utilities
export const badgeColors = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-700',
};

// Status Badge Component
export function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    NEW: badgeColors.blue,
    PENDING: badgeColors.yellow,
    ASSIGNED: badgeColors.purple,
    ACCEPTED: badgeColors.green,
    IN_PROGRESS: badgeColors.blue,
    COMPLETED: badgeColors.green,
    REJECTED: badgeColors.red,
    CANCELLED: badgeColors.gray,
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || badgeColors.gray}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

