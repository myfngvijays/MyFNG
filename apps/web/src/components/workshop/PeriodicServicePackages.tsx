'use client';

/** Package cards + checkpoints modal (animations in globals.css). */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkshopPublicPagePackage } from './types';

type PeriodicServicePackagesProps = {
  packages: WorkshopPublicPagePackage[];
  subtitle?: string;
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

export default function PeriodicServicePackages({ packages, subtitle }: PeriodicServicePackagesProps) {
  const displayPackages = packages.length > 0 ? packages : defaultPackages;
  const [modalPkg, setModalPkg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!modalPkg) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalPkg]);

  const openModal = (name: string) => setModalPkg(name);
  const closeModal = () => setModalPkg(null);

  const modalData = modalPkg ? fullCheckpoints[modalPkg] : null;

  return (
    <>
      <section className="relative overflow-visible bg-[#f8faff] py-8 pt-6 sm:py-10 sm:pt-8">
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:w-[90%]">
          <div className="mb-5 text-center sm:mb-6">
            <h2 className="text-2xl font-extrabold leading-tight sm:text-[32px]">Periodic Service Packages</h2>
            <p className="mt-2 text-sm text-[#666]">
              {subtitle || 'Choose the best car service package for your vehicle'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 overflow-visible sm:gap-[25px] lg:grid-cols-4">
            {displayPackages.map((pkg, index) => {
              const points = activityPoints[pkg.name] || `${(index + 1) * 15} Activity Points`;
              const primePrice = Math.round(
                Number((typeof pkg.price === 'string' ? pkg.price : '').replace(/[₹,]/g, '')) * 0.9
              );
              const isRecommended = index === 1;
              return (
                <div
                  key={`${pkg.name}-${index}`}
                  className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-transform duration-300 sm:rounded-[20px] hover:sm:-translate-y-2 ${
                    isRecommended ? 'border-2 border-[#3563e9]' : ''
                  }`}
                >
                  {isRecommended ? (
                    <div className="bg-[#f97316] px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-white sm:text-[10px]">
                      MyFNG Recommended
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-3 pb-0 sm:p-[30px] sm:pb-0">
                    <h3 className="text-sm font-bold leading-tight sm:text-[22px]">{pkg.name}</h3>
                    <span className="mb-2 mt-1.5 block text-[10px] font-semibold leading-tight text-[#3563e9] sm:mb-5 sm:mt-[10px] sm:text-base">
                      {points}
                    </span>

                    <ul className="mb-2 hidden flex-1 list-none p-0 sm:mb-[15px] sm:block">
                      {(pkg.features || []).slice(0, 5).map((feature, fi) => (
                        <li key={fi} className="mb-2 text-[14px]">
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => openModal(pkg.name)}
                      className="mb-2 cursor-pointer border-none bg-transparent p-0 text-left text-[10px] font-medium text-[#3563e9] underline-offset-2 hover:underline sm:mb-5 sm:text-[13px]"
                    >
                      View all points
                    </button>

                    <div className="mb-3 sm:mb-[15px]">
                      <span className="text-[9px] uppercase tracking-wide text-[#999] sm:text-[11px]">starts from</span>
                      <div className="text-lg font-extrabold sm:text-[28px]">
                        {typeof pkg.price === 'number' ? `₹${pkg.price.toLocaleString('en-IN')}` : pkg.price || '—'}
                      </div>
                    </div>

                    <a
                      href="/book-service"
                      className="mb-3 block w-full rounded-[10px] border-none bg-[#3563e9] py-2.5 text-center text-[11px] font-semibold text-white no-underline transition-colors hover:bg-[#2b53c7] sm:mb-5 sm:rounded-[12px] sm:py-3 sm:text-[13px]"
                    >
                      Select Package
                    </a>
                  </div>

                  {/* Prime Members Section */}
                  <div className="rounded-b-2xl border-t border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 sm:rounded-b-[20px] sm:px-5 sm:py-4">
                    <div className="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                      <span className="text-[11px] sm:text-[13px]">🔥</span>
                      <span className="text-[10px] font-bold text-[#b45309] sm:text-[12px]">Prime Save 10%</span>
                    </div>
                    <div className="mb-1 flex items-center gap-1.5 sm:mb-1.5 sm:gap-2">
                      <span className="text-[10px] text-[#999] line-through sm:text-[12px]">
                        {typeof pkg.price === 'number' ? `₹${pkg.price.toLocaleString('en-IN')}` : pkg.price}
                      </span>
                      <span className="text-sm font-bold text-[#15803d] sm:text-[16px]">
                        ₹{primePrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="mb-1 hidden text-[10px] text-[#92400e] sm:mb-2 sm:block">
                      + Free Inspection, Car Scanning, Extended Warranty & more
                    </p>
                    <div className="hidden items-center gap-2 sm:flex">
                      <span className="rounded bg-[#1a1a1a] px-2 py-0.5 text-[9px] text-white">Android</span>
                      <span className="rounded bg-[#1a1a1a] px-2 py-0.5 text-[9px] text-white">iOS</span>
                      <span className="text-[10px] font-semibold text-[#f97316]">₹699/yr</span>
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

      {/* MODAL — compact bottom sheet on mobile, centered dialog on desktop */}
      {mounted &&
        modalPkg &&
        modalData &&
        createPortal(
          <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-labelledby="package-checkpoints-title">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={closeModal} aria-hidden />

            <div
              className="package-sheet-panel absolute inset-x-0 bottom-0 flex max-h-[58vh] flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(85vh,680px)] sm:w-[min(92vw,640px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* drag handle — mobile only */}
              <div className="flex shrink-0 justify-center pt-2.5 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <div className="relative shrink-0 border-b border-gray-100 px-4 pb-3 pt-1 sm:px-6 sm:pb-4 sm:pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute right-3 top-1 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#666] transition hover:bg-gray-100 hover:text-black sm:right-4 sm:top-4"
                  aria-label="Close"
                >
                  ✕
                </button>
                <h3
                  id="package-checkpoints-title"
                  className="pr-9 text-sm font-bold leading-snug text-brand-secondary sm:text-base"
                >
                  {modalData.title}
                </h3>
                <p className="mt-1 text-[11px] text-[#666] sm:hidden">{modalData.items.length} checkpoints included</p>
                <div className="mt-2 hidden rounded-xl bg-[#eaf8f0] p-3 text-xs font-semibold sm:block sm:mt-3 sm:p-3.5 sm:text-[13px]">
                  All Checkpoints Included
                  <p className="mt-0.5 font-normal text-[#555]">
                    Complete list of service checkpoints for this package.
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 pb-4 sm:px-6 sm:py-3 sm:pb-6">
                <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 sm:gap-1.5">
                  {modalData.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 text-[12px] leading-snug sm:py-1.5 sm:text-[13px]">
                      <span className="mt-0.5 shrink-0 text-[11px] font-bold text-[#15803d]">✔</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
