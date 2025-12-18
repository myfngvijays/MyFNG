'use client';

import React from 'react';
import { 
  Briefcase, UserCheck, Wrench, PauseCircle, 
  CheckCircle2, Truck, DollarSign, AlertTriangle 
} from 'lucide-react';

interface DashboardMetricsProps {
  metrics: {
    totalJobsToday: number;
    assignedJobs: number;
    inProgressJobs: number;
    jobsOnHold: number;
    jobsAwaitingQC: number;
    pendingPickups: number;
    pendingExtraWorkApprovals: number;
    slaAtRiskJobs: number;
  };
  loading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, bgColor }) => {
  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
        </div>
        <div className={`${bgColor} p-4 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default function DashboardMetrics({ metrics, loading = false }: DashboardMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const metricsConfig = [
    {
      title: 'Total Jobs Today',
      value: metrics.totalJobsToday,
      icon: <Briefcase className="w-8 h-8 text-blue-600" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Assigned Jobs',
      value: metrics.assignedJobs,
      icon: <UserCheck className="w-8 h-8 text-purple-600" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'In Progress',
      value: metrics.inProgressJobs,
      icon: <Wrench className="w-8 h-8 text-green-600" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'On Hold',
      value: metrics.jobsOnHold,
      icon: <PauseCircle className="w-8 h-8 text-orange-600" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      title: 'Awaiting QC',
      value: metrics.jobsAwaitingQC,
      icon: <CheckCircle2 className="w-8 h-8 text-indigo-600" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    {
      title: 'Pending Pickups',
      value: metrics.pendingPickups,
      icon: <Truck className="w-8 h-8 text-cyan-600" />,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100'
    },
    {
      title: 'Additional Jobs Approval',
      value: metrics.pendingExtraWorkApprovals,
      icon: <DollarSign className="w-8 h-8 text-teal-600" />,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100'
    },
    {
      title: 'SLA At Risk',
      value: metrics.slaAtRiskJobs,
      icon: <AlertTriangle className="w-8 h-8 text-red-600" />,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricsConfig.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          icon={metric.icon}
          color={metric.color}
          bgColor={metric.bgColor}
        />
      ))}
    </div>
  );
}

