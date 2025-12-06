'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Users } from 'lucide-react';

export default function DynamicFOMO() {
  const [activeUsers, setActiveUsers] = useState(2847);
  const [slotsLeft, setSlotsLeft] = useState(3);
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    // Update active users every 3-5 seconds (fluctuate between 2800-2900)
    const userInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 20) - 10; // -10 to +10
      setActiveUsers(prev => {
        const newValue = prev + change;
        return Math.max(2800, Math.min(2900, newValue)); // Keep between 2800-2900
      });
      setLastUpdate('now');
    }, Math.random() * 2000 + 3000); // Random between 3-5 seconds

    // Update slots left every 8-15 seconds (decrease slowly)
    const slotsInterval = setInterval(() => {
      setSlotsLeft(prev => {
        if (prev <= 1) return Math.floor(Math.random() * 2) + 4; // Reset to 4-5
        return prev - 1;
      });
    }, Math.random() * 7000 + 8000); // Random between 8-15 seconds

    // Update "last update" indicator
    const updateInterval = setInterval(() => {
      setLastUpdate('just now');
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(userInterval);
      clearInterval(slotsInterval);
      clearInterval(updateInterval);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm animate-fade-in-up" style={{animationDelay: '0.5s'}}>
      {/* Active Users - Dynamic */}
      <div className="flex items-center gap-2 glass px-4 py-2 rounded-full transition-all duration-300">
        <div className="relative flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <div className="absolute w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
        </div>
        <Users className="w-4 h-4 text-green-400" />
        <span className="text-gray-200 font-medium">
          {activeUsers.toLocaleString()} Active Now
        </span>
      </div>

      {/* Slots Left - Dynamic with Urgency Color */}
      <div className={`flex items-center gap-2 glass px-4 py-2 rounded-full transition-all duration-500 ${
        slotsLeft <= 2 ? 'border border-red-500/50 animate-pulse' : ''
      }`}>
        <AlertCircle className={`w-4 h-4 ${
          slotsLeft <= 2 ? 'text-red-400' : 'text-orange-400'
        }`} />
        <span className="text-gray-200 font-medium">
          Only <span className={`font-bold ${
            slotsLeft <= 2 ? 'text-red-400' : 'text-orange-400'
          }`}>{slotsLeft}</span> slots left today!
        </span>
      </div>
    </div>
  );
}

