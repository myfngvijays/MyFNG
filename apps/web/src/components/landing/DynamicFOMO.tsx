'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Users } from 'lucide-react';

export default function DynamicFOMO() {
  // Initialize with fixed values to avoid hydration mismatch
  const [activeUsers, setActiveUsers] = useState(550); // Middle of 400-700 range
  const [slotsLeft, setSlotsLeft] = useState(20);
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    // Initialize with random value in desired range only on client
    setActiveUsers(Math.floor(Math.random() * 300) + 400);
    
    // Update active users every 3-5 seconds (fluctuate between 400-700)
    const userInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 30) - 15; // -15 to +15
      setActiveUsers(prev => {
        const newValue = prev + change;
        return Math.max(400, Math.min(700, newValue)); // Keep between 400-700
      });
      setLastUpdate('now');
    }, Math.random() * 2000 + 3000); // Random between 3-5 seconds

    // Update slots left every 5-10 seconds (fluctuate around 20)
    const slotsInterval = setInterval(() => {
      setSlotsLeft(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const newValue = prev + change;
        // Keep slots between 15-25 (centered around 20)
        return Math.max(15, Math.min(25, newValue));
      });
    }, Math.random() * 5000 + 5000); // Random between 5-10 seconds

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
      <div className="flex items-center gap-2 rounded-full bg-white/85 backdrop-blur border border-gray-200 shadow-sm px-4 py-2 transition-all duration-300">
        <div className="relative flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <div className="absolute w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
        </div>
        <Users className="w-4 h-4 text-green-600" />
        <span className="text-gray-900 font-semibold">
          {activeUsers.toLocaleString()} Active Now
        </span>
      </div>

      {/* Slots Left - Dynamic with Urgency Color */}
      <div
        className={`flex items-center gap-2 rounded-full bg-white/85 backdrop-blur border shadow-sm px-4 py-2 transition-all duration-500 ${
          slotsLeft <= 2 ? 'border-red-300 animate-pulse' : 'border-gray-200'
        }`}
      >
        <AlertCircle className={`w-4 h-4 ${
          slotsLeft <= 2 ? 'text-red-600' : 'text-orange-600'
        }`} />
        <span className="text-gray-900 font-semibold">
          Only <span className={`font-bold ${
            slotsLeft <= 2 ? 'text-red-700' : 'text-orange-700'
          }`}>{slotsLeft}</span> slots left today!
        </span>
      </div>
    </div>
  );
}

