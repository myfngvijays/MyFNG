'use client';

import { useState, useEffect } from 'react';
import { Users, Car, Clock, TrendingUp } from 'lucide-react';

export default function LiveStats() {
  /**
   * Services Completed requirement (as per request):
   * - Lifetime counter (never decreases)
   * - Adds ~27 services per day
   * - Spread across 24 hours (no one-time jump)
   * - Time-based (deterministic), not random
   */
  const SERVICES_BASE = 15234;
  // Anchor time in IST so daily distribution feels natural for India users
  const SERVICES_ANCHOR_MS = new Date('2025-12-14T00:00:00+05:30').getTime();
  const SERVICES_PER_DAY = 27;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const computeServicesCompleted = (nowMs: number) => {
    const elapsed = Math.max(0, nowMs - SERVICES_ANCHOR_MS);
    const added = Math.floor((elapsed * SERVICES_PER_DAY) / DAY_MS);
    return SERVICES_BASE + added;
  };

  // Initialize with fixed values to avoid hydration mismatch
  const [servicesCompleted, setServicesCompleted] = useState(SERVICES_BASE);
  const [avgResponseTime, setAvgResponseTime] = useState(10); // Middle of 5-15 range

  useEffect(() => {
    // Initialize dynamic values on client side (FOMO), but keep services deterministic
    setAvgResponseTime(Math.floor(Math.random() * 10) + 5); // 5-15

    // Services: compute immediately, then re-compute periodically (time-based lifetime counter)
    setServicesCompleted(computeServicesCompleted(Date.now()));
    const servicesInterval = setInterval(() => {
      setServicesCompleted(computeServicesCompleted(Date.now()));
    }, 30000); // every 30s is enough; increments happen gradually through the day

    // Update response time every 10-20 seconds (fluctuate between 5-15 min)
    const responseInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
      setAvgResponseTime((prev) => {
        const newValue = prev + change;
        return Math.max(5, Math.min(15, newValue));
      });
    }, Math.random() * 10000 + 10000); // Random between 10-20 seconds

    return () => {
      clearInterval(servicesInterval);
      clearInterval(responseInterval);
    };
  }, []);

  const statCards = [
    {
      icon: Users,
      label: 'Customers Served',
      value: '10,000',
      suffix: '+',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: Car,
      label: 'Cars Serviced',
      value: servicesCompleted.toLocaleString(),
      suffix: '+',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      icon: Clock,
      label: 'Avg Response Time',
      value: avgResponseTime,
      suffix: ' min',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      icon: TrendingUp,
      label: 'Customer Rating',
      value: '⭐ 4.7 / 5',
      suffix: '',
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

