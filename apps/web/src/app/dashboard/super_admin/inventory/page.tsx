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
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory Master</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Manage Products, Service Packages, and Zones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-1 flex flex-wrap sm:flex-nowrap gap-1 sm:space-x-1 w-full sm:w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
            activeTab === 'products'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Products & Parts</span>
          <span className="sm:hidden">Products</span>
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
            activeTab === 'packages'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Service Packages</span>
          <span className="sm:hidden">Packages</span>
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
            activeTab === 'zones'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Map className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          Zones
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 min-h-[400px] sm:min-h-[500px]">
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'packages' && <PackagesTab />}
        {activeTab === 'zones' && <ZonesTab />}
      </div>
    </div>
  );
}

