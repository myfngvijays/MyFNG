'use client';

import { Shield, Award, Clock, ThumbsUp } from 'lucide-react';

export default function TrustBadges() {
  const badges = [
    {
      icon: Shield,
      title: '100% Secure',
      desc: 'Data Protected'
    },
    {
      icon: Award,
      title: 'Certified',
      desc: 'Quality Assured'
    },
    {
      icon: Clock,
      title: '24/7 Support',
      desc: 'Always Available'
    },
    {
      icon: ThumbsUp,
      title: '10K+ Happy',
      desc: 'Customers'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <div
            key={index}
            className="bg-white/50 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3 animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">{badge.title}</div>
              <div className="text-xs text-gray-600">{badge.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

