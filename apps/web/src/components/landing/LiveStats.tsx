'use client';

import { useState, useEffect } from 'react';
import { Users, Car, Clock, TrendingUp } from 'lucide-react';

export default function LiveStats() {
  const [stats, setStats] = useState({
    activeUsers: 0,
    servicesCompleted: 0,
    avgResponseTime: 0,
    customerSatisfaction: 0
  });

  useEffect(() => {
    // Animate counters
    const targets = {
      activeUsers: 2847,
      servicesCompleted: 15234,
      avgResponseTime: 12,
      customerSatisfaction: 98
    };

    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      
      setStats({
        activeUsers: Math.floor(targets.activeUsers * progress),
        servicesCompleted: Math.floor(targets.servicesCompleted * progress),
        avgResponseTime: Math.floor(targets.avgResponseTime * progress),
        customerSatisfaction: Math.floor(targets.customerSatisfaction * progress)
      });

      if (step >= steps) {
        clearInterval(timer);
        setStats(targets);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const statCards = [
    {
      icon: Users,
      label: 'Active Users',
      value: stats.activeUsers.toLocaleString(),
      suffix: '+',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: Car,
      label: 'Services Completed',
      value: stats.servicesCompleted.toLocaleString(),
      suffix: '+',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      icon: Clock,
      label: 'Avg Response Time',
      value: stats.avgResponseTime,
      suffix: ' min',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      icon: TrendingUp,
      label: 'Customer Satisfaction',
      value: stats.customerSatisfaction,
      suffix: '%',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all animate-fade-in-up border border-gray-100"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4`}>
              <Icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="text-3xl font-bold text-brand-secondary mb-1">
              {stat.value}{stat.suffix}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}

