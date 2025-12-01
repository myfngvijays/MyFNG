'use client';

import React, { useState, useEffect } from 'react';
import { Package, Map, Box, Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Components
import ProductsTab from './tabs/ProductsTab';
import PackagesTab from './tabs/PackagesTab';
import ZonesTab from './tabs/ZonesTab';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'packages' | 'zones'>('products');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Master</h1>
          <p className="text-gray-500">Manage Products, Service Packages, and Zones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex space-x-1 w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'products'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Box className="w-4 h-4" />
          Products & Parts
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'packages'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Service Packages
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'zones'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Map className="w-4 h-4" />
          Zones
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px]">
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'packages' && <PackagesTab />}
        {activeTab === 'zones' && <ZonesTab />}
      </div>
    </div>
  );
}

