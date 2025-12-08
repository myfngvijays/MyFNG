'use client';

import { useState, useEffect } from 'react';
import { Users, Car, Clock, TrendingUp } from 'lucide-react';

export default function LiveStats() {
  // Initialize with fixed values to avoid hydration mismatch
  const [stats, setStats] = useState({
    activeUsers: 550, // Middle of 400-700 range
    servicesCompleted: 15234, // Starting value
    avgResponseTime: 10, // Middle of 5-15 range
    customerSatisfaction: 98.25 // Middle of 97.0-99.5 range
  });

  useEffect(() => {
    // Initialize with random values only on client side
    setStats({
      activeUsers: Math.floor(Math.random() * 300) + 400, // 400-700
      servicesCompleted: 15234,
      avgResponseTime: Math.floor(Math.random() * 10) + 5, // 5-15
      customerSatisfaction: 97 + Math.random() * 2.5 // 97.0-99.5
    });
    // Calculate services to add per day (27 services per day)
    // Distribute across 24 hours = 27/24 = 1.125 services per hour
    // Update every 10 seconds for smoother real-time effect
    const servicesPerSecond = 27 / (24 * 60 * 60); // 27 services per day = per second
    const servicesInterval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        servicesCompleted: Math.floor(prev.servicesCompleted + (servicesPerSecond * 10)) // Add 10 seconds worth
      }));
    }, 10000); // Update every 10 seconds for smoother animation

    // Update active users every 3-5 seconds (fluctuate between 400-700) - FOMO effect
    const userInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 30) - 15; // -15 to +15
      setStats(prev => {
        const newValue = prev.activeUsers + change;
        return {
          ...prev,
          activeUsers: Math.max(400, Math.min(700, newValue)) // Keep between 400-700
        };
      });
    }, Math.random() * 2000 + 3000); // Random between 3-5 seconds

    // Update response time every 10-20 seconds (fluctuate between 5-15 min)
    const responseInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
      setStats(prev => {
        const newValue = prev.avgResponseTime + change;
        return {
          ...prev,
          avgResponseTime: Math.max(5, Math.min(15, newValue)) // Keep between 5-15
        };
      });
    }, Math.random() * 10000 + 10000); // Random between 10-20 seconds

    // Update customer satisfaction every 8-15 seconds (fluctuate between 97.0-99.5%)
    const satisfactionInterval = setInterval(() => {
      const change = (Math.random() * 0.3) - 0.15; // -0.15 to +0.15
      setStats(prev => {
        const newValue = prev.customerSatisfaction + change;
        return {
          ...prev,
          customerSatisfaction: Math.max(97.0, Math.min(99.5, newValue)) // Keep between 97.0-99.5
        };
      });
    }, Math.random() * 7000 + 8000); // Random between 8-15 seconds

    return () => {
      clearInterval(servicesInterval);
      clearInterval(userInterval);
      clearInterval(responseInterval);
      clearInterval(satisfactionInterval);
    };
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
      value: stats.customerSatisfaction.toFixed(1),
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

