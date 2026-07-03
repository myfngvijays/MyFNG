'use client';

import React, { useState } from 'react';
import type { WorkshopPublicPagePackage } from './types';

type WorkshopPackagesProps = {
  packages: WorkshopPublicPagePackage[];
};

const defaultPackages: WorkshopPublicPagePackage[] = [
  {
    name: 'Basic Service',
    price: '₹2,999',
    features: [
      'Engine Oil Replacement',
      'Oil Filter Replacement',
      'Air Filter Cleaning',
      'Spark Plugs Servicing',
      'Interior Vacuuming & Body Wash',
    ],
  },
  {
    name: 'General Service',
    price: '₹5,000',
    features: [
      'Everything in Basic +',
      'Brake Pads & Fluid Check',
      'Battery Terminal Cleaning',
      'AC Performance Check',
      'Test Drive & Final Inspection',
    ],
  },
  {
    name: 'Premium Service',
    price: '₹6,800',
    features: [
      'Everything in General +',
      'All Brake Cleaning & Lubrication',
      'AC Disinfectant Spray',
      'Tyre Rotation & Torque',
      'Diagnostics Scan & Report',
    ],
  },
  {
    name: 'Platinum Service',
    price: '₹11,300',
    features: [
      'Everything in Premium +',
      'Engine Compression Test',
      'Throttle Body & EGR Cleaning',
      'Interior Deep Cleaning',
      'Paint Protection & Underbody Coating',
    ],
  },
];

const activityPoints: Record<string, string> = {
  'Basic Service': '15 Activity Points',
  'General Service': '30 Activity Points',
  'Premium Service': '50 Activity Points',
  'Platinum Service': '60 Activity Points',
};

const fullCheckpoints: Record<string, { title: string; items: string[] }> = {
  'Basic Service': {
    title: 'BASIC SERVICE – 15 Checkpoints',
    items: [
      'Clean Air Filter',
      'Spark Plugs Servicing',
      'Top up Brake Oil',
      'Top up Gear Oil',
      'Top up Power Steering Oil & Clutch Oil (If applicable)',
      'Top up Coolant',
      'Top up Battery Water',
      'Top up Wiper Water Tank',
      'Replace Oil Filter',
      'Replace Engine Oil',
      'Clean Cabin AC Filter',
      'Interior Vacuuming',
      'Grease Door Hinges',
      'Inspect & Top up Tyre Pressure',
      'Body Wash',
    ],
  },
  'General Service': {
    title: 'GENERAL SERVICE – 30 Checkpoints',
    items: [
      'Clean Air Filter',
      'Spark Plugs Servicing',
      'Top up Brake Oil',
      'Top up Gear Oil',
      'Top up Power Steering Oil & Clutch Oil (If applicable)',
      'Top up Coolant',
      'Top up Battery Water',
      'Top up Wiper Water Tank',
      'Replace Oil Filter',
      'Replace Engine Oil',
      'Clean Cabin AC Filter',
      'Interior Vacuuming',
      'Grease Door Hinges',
      'Inspect & Top up Tyre Pressure',
      'Body Wash',
      'Check Brake Pads',
      'Check Brake Fluid',
      'Check Suspension',
      'Check Tyre Condition',
      'Wheel Alignment Check',
      'Battery Terminal Cleaning',
      'Check Alternator Belt',
      'Check Radiator Cap',
      'Check Windshield Wipers',
      'Check Horn',
      'Check All Lights',
      'Check AC Performance',
      'Check Steering System',
      'Test Drive',
      'Final Inspection',
    ],
  },
  'Premium Service': {
    title: 'PREMIUM SERVICE – 50 Checkpoints',
    items: [
      'Clean Air Filter',
      'Spark Plugs Cleaning & Adjustment',
      'Top up Brake Oil',
      'Top up Gear Oil',
      'Top up Power Steering Oil & Clutch Oil (If applicable)',
      'Battery Terminal Cleaning',
      'Battery Load Testing',
      'Battery Terminal Coating',
      'Top up Battery Water',
      'Top up Coolant',
      'Top up Wiper Water Tank with Screen Wash',
      'Align Wiper Water Nozzles',
      'Replace Oil Filter',
      'Replace Engine Oil',
      'Check all Radiator Lines & Hoses',
      'Inspect Belts for Cracks & Hardness / Adjustment',
      'Check and Adjust Clutch Play (if required)',
      'Check All Glass Winder Operations',
      'Window Glass Run Channel Lubrication',
      'Clean AC Filter',
      'Check AC Cooling / Gas Leak Test',
      'AC Disinfectant Spray in AC Vents',
      'Inspect Front Lights, Rear Lights & Indicators',
      'Inspect Internal Lights & Power Switches',
      'Interior Vacuuming',
      'Dashboard Polish',
      'Anti Squeak Spray on Door Hinges',
      'Greasing on Door Hinges',
      'Check Door Locks & Central Locking System',
      'Door Locks Lubrication',
      'All Wheel Nuts & Bolts Greasing',
      'Front Brake Pads Cleaning',
      'Front Brake Calliper Pins Lubrication',
      'Rear Brake Pads / Liners Cleaning',
      'Rear Brake Calliper Pins Lubrication / Liners Setting',
      'Air Bleeding from Brake Fluid Lines',
      'Hand Brake Setting',
      'Check Wheel Bearings',
      'Check Ball Joints, Steering Rack & Linkages',
      'Inspect Front Shock Absorbers & Suspension Struts',
      'Inspect Rear Shock Absorbers & Coil Pads',
      'Re-torque all Nuts and Bolts on Chassis & Body',
      'Check all Tyres & Rims',
      'Inspect all Wheel Arcs & Under Body',
      'Tyre Rotation',
      'Final Wheel Nuts Torque',
      'Top up Tyre Pressure',
      'Trial Drive & Diagnostics Scanning',
      'Wash',
      'Comprehensive Report',
    ],
  },
  'Platinum Service': {
    title: 'PLATINUM SERVICE – 60 Checkpoints',
    items: [
      'Clean Air Filter',
      'Spark Plugs Cleaning & Adjustment',
      'Top up Brake Oil',
      'Top up Gear Oil',
      'Top up Power Steering Oil & Clutch Oil (If applicable)',
      'Battery Terminal Cleaning',
      'Battery Load Testing',
      'Battery Terminal Coating',
      'Top up Battery Water',
      'Top up Coolant',
      'Top up Wiper Water Tank with Screen Wash',
      'Align Wiper Water Nozzles',
      'Replace Oil Filter',
      'Replace Engine Oil',
      'Check all Radiator Lines & Hoses',
      'Inspect Belts for Cracks & Hardness / Adjustment',
      'Check and Adjust Clutch Play (if required)',
      'Check All Glass Winder Operations',
      'Window Glass Run Channel Lubrication',
      'Clean AC Filter',
      'Check AC Cooling / Gas Leak Test',
      'AC Disinfectant Spray in AC Vents',
      'Inspect Front Lights, Rear Lights & Indicators',
      'Inspect Internal Lights & Power Switches',
      'Interior Vacuuming',
      'Dashboard Polish',
      'Anti Squeak Spray on Door Hinges',
      'Greasing on Door Hinges',
      'Check Door Locks & Central Locking System',
      'Door Locks Lubrication',
      'All Wheel Nuts & Bolts Greasing',
      'Front Brake Pads Cleaning',
      'Front Brake Calliper Pins Lubrication',
      'Rear Brake Pads / Liners Cleaning',
      'Rear Brake Calliper Pins Lubrication / Liners Setting',
      'Air Bleeding from Brake Fluid Lines',
      'Hand Brake Setting',
      'Check Wheel Bearings',
      'Check Ball Joints, Steering Rack & Linkages',
      'Inspect Front Shock Absorbers & Suspension Struts',
      'Inspect Rear Shock Absorbers & Coil Pads',
      'Re-torque all Nuts and Bolts on Chassis & Body',
      'Check all Tyres & Rims',
      'Inspect all Wheel Arcs & Under Body',
      'Tyre Rotation',
      'Final Wheel Nuts Torque',
      'Top up Tyre Pressure',
      'Engine Compression Test',
      'Fuel System Cleaning',
      'Throttle Body Cleaning',
      'EGR Valve Cleaning',
      'Interior Deep Cleaning',
      'Leather Seat Conditioning',
      'Headlight Restoration',
      'Paint Protection Coating',
      'Underbody Coating',
      'Trial Drive & Diagnostics Scanning',
      'Premium Wash & Wax',
      'Comprehensive Report',
      'Customer Satisfaction Follow-up',
    ],
  },
};

export default function WorkshopPackages({ packages }: WorkshopPackagesProps) {
  const displayPackages = packages.length > 0 ? packages : defaultPackages;
  const [modalPkg, setModalPkg] = useState<string | null>(null);

  const openModal = (name: string) => setModalPkg(name);
  const closeModal = () => setModalPkg(null);

  const modalData = modalPkg ? fullCheckpoints[modalPkg] : null;

  return (
    <>
      <section className="py-20 bg-[#f8faff]">
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <div className="text-center mb-[50px]">
            <h2 className="text-[32px] font-extrabold">Periodic Service Packages</h2>
            <p className="text-sm text-[#666] mt-2">
              Choose the best car service package for your vehicle
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[25px]">
            {displayPackages.map((pkg, index) => {
              const points = activityPoints[pkg.name] || `${(index + 1) * 15} Activity Points`;
              const primePrice = Math.round(
                Number((typeof pkg.price === 'string' ? pkg.price : '').replace(/[₹,]/g, '')) * 0.9
              );
              return (
                <div
                  key={`${pkg.name}-${index}`}
                  className={`bg-white rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-transform duration-300 hover:-translate-y-2 flex flex-col ${
                    index === 1 ? 'border-2 border-[#3563e9] relative' : ''
                  }`}
                >
                  {index === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f97316] text-white text-[11px] font-bold px-4 py-1 rounded-full uppercase tracking-wide whitespace-nowrap">
                      MyFNG Recommended
                    </div>
                  )}
                  <div className="p-[30px] pb-0 flex-1 flex flex-col">
                    <h3 className="text-[22px] font-bold">{pkg.name}</h3>
                    <span className="text-[#3563e9] font-semibold block mt-[10px] mb-5">
                      {points}
                    </span>

                    <ul className="list-none p-0 mb-[15px] flex-1">
                      {(pkg.features || []).slice(0, 5).map((feature, fi) => (
                        <li key={fi} className="mb-2 text-[14px]">
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => openModal(pkg.name)}
                      className="bg-transparent border-none text-[#3563e9] cursor-pointer mb-5 text-[13px] font-medium p-0 text-left"
                    >
                      View all points
                    </button>

                    <div className="mb-[15px]">
                      <span className="text-[11px] text-[#999] uppercase tracking-wide">starts from</span>
                      <div className="text-[28px] font-extrabold">
                        {typeof pkg.price === 'number' ? `₹${pkg.price.toLocaleString('en-IN')}` : pkg.price || '—'}
                      </div>
                    </div>

                    <a href="/book-service" className="block w-full py-3 bg-[#3563e9] text-white border-none rounded-[12px] font-semibold text-[13px] hover:bg-[#2b53c7] transition-colors text-center no-underline mb-5">
                      Select Package
                    </a>
                  </div>

                  {/* Prime Members Section */}
                  <div className="bg-[#fffbeb] border-t border-[#fde68a] rounded-b-[20px] px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[13px]">🔥</span>
                      <span className="text-[12px] font-bold text-[#b45309]">Prime Members Save 10%</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[12px] text-[#999] line-through">
                        {typeof pkg.price === 'number' ? `₹${pkg.price.toLocaleString('en-IN')}` : pkg.price}
                      </span>
                      <span className="text-[16px] font-bold text-[#15803d]">
                        ₹{primePrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#92400e] mb-2">+ Free Inspection, Car Scanning, Extended Warranty & more</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-[#1a1a1a] text-white px-2 py-0.5 rounded">Android</span>
                      <span className="text-[9px] bg-[#1a1a1a] text-white px-2 py-0.5 rounded">iOS</span>
                      <span className="text-[10px] text-[#f97316] font-semibold">₹699/yr</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-[13px] text-[#dc2626] italic mt-6">
            * Prices may vary based on car make, model, and year of manufacture. Final pricing will be confirmed at the time of booking.
          </p>
        </div>
      </section>

      {/* MODAL */}
      {modalPkg && modalData && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
          onClick={closeModal}
        >
          <div
            className="bg-white w-[85%] max-w-[1000px] p-10 rounded-[20px] relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              onClick={closeModal}
              className="absolute top-5 right-[25px] text-[22px] cursor-pointer text-[#666] hover:text-black"
            >
              ✕
            </span>
            <h3 className="text-lg font-bold mb-4">{modalData.title}</h3>
            <div className="bg-[#eaf8f0] rounded-[12px] p-5 mt-5 mb-[30px] font-semibold text-[13px]">
              All Checkpoints Included
              <br />
              <small className="font-normal text-[#555]">
                Complete list of service checkpoints for this package.
              </small>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[15px]">
              {modalData.items.map((item, i) => (
                <div key={i} className="p-[10px] text-[14px]">
                  ✔ {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
