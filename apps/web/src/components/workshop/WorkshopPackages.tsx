'use client';

import React, { useState } from 'react';
import type { WorkshopPublicPagePackage } from './types';

type WorkshopPackagesProps = {
  packages: WorkshopPublicPagePackage[];
};

const defaultPackages: WorkshopPublicPagePackage[] = [
  {
    name: 'Basic Service',
    price: '₹2,499',
    features: [
      'Engine oil replacement',
      'Oil filter replacement',
      'Spark plug service',
      'Brake inspection',
      'Fluid top-up',
    ],
  },
  {
    name: 'General Service',
    price: '₹3,750',
    features: [
      'Everything in Basic',
      'Air filter cleaning',
      'Battery check',
      'AC inspection',
      'Wheel check',
    ],
  },
  {
    name: 'Premium Service',
    price: '₹5,750',
    features: [
      'Everything in General',
      'Diagnostics scanning',
      'Fuel system check',
      'Interior vacuum',
      'Comprehensive inspection',
    ],
  },
  {
    name: 'Platinum Service',
    price: '₹7,600',
    features: [
      'Everything in Premium',
      'Seat shampooing',
      'Machine polishing',
      'UV coating',
      'Engine dressing',
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
      'Engine Oil Replacement',
      'Oil Filter Replacement',
      'Spark Plug Service',
      'Brake Inspection',
      'Fluid Top-Up',
      'Battery Check',
      'Air Filter Cleaning',
      'Coolant Check',
      'Brake Oil Check',
      'Tyre Pressure Check',
      'Wiper Check',
      'Lights Inspection',
      'AC Check',
      'General Inspection',
      'Trial Drive',
    ],
  },
  'General Service': {
    title: 'GENERAL SERVICE – 30 Checkpoints',
    items: [
      'Clean Air Filter',
      'Clean & Adjust Spark Plugs',
      'Top up Brake Oil',
      'Replace Engine Oil',
      'Interior Vacuuming',
      'Cleaning Cabin AC Filter',
      'Doors Greasing',
      'Tyre Rotation',
      'Brake Bleeding',
      'Check AC Cooling',
      'Dashboard Polish',
      'Battery Terminal Cleaning',
    ],
  },
  'Premium Service': {
    title: 'PREMIUM SERVICE – 50 Checkpoints',
    items: [
      'Everything in General',
      'Diagnostics Scanning',
      'Fuel System Check',
      'Interior Vacuum',
      'Comprehensive Inspection',
      'Exhaust System Check',
      'Suspension Check',
      'Power Steering Fluid',
      'Transmission Fluid',
      'Cooling System Flush',
    ],
  },
  'Platinum Service': {
    title: 'PLATINUM SERVICE – 60 Checkpoints',
    items: [
      'Everything in Premium',
      'Seat Shampooing',
      'Machine Polishing',
      'UV Coating',
      'Engine Dressing',
      'Underbody Rust Protection',
      'Dashboard Restoration',
      'Headlight Restoration',
      'Paint Protection',
      'Complete Detailing',
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
              return (
                <div
                  key={`${pkg.name}-${index}`}
                  className={`bg-white p-[30px] rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-transform duration-300 hover:-translate-y-2 ${
                    index === 0 ? 'border-2 border-[#3563e9]' : ''
                  }`}
                >
                  <h3 className="text-[22px] font-bold">{pkg.name}</h3>
                  <span className="text-[#3563e9] font-semibold block mt-[10px] mb-5">
                    {points}
                  </span>

                  <ul className="list-none p-0 mb-[15px]">
                    {(pkg.features || []).slice(0, 5).map((feature, fi) => (
                      <li key={fi} className="mb-2 text-[14px]">
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => openModal(pkg.name)}
                    className="bg-transparent border-none text-[#3563e9] cursor-pointer mb-5 text-[13px] font-medium"
                  >
                    View all points
                  </button>

                  <div className="text-[28px] font-extrabold mb-[15px]">
                    {typeof pkg.price === 'number' ? `₹${pkg.price.toLocaleString('en-IN')}` : pkg.price || '—'}
                  </div>

                  <button className="w-full py-3 bg-[#3563e9] text-white border-none rounded-[12px] font-semibold text-[13px] hover:bg-[#2b53c7] transition-colors">
                    Select Package
                  </button>
                </div>
              );
            })}
          </div>
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
