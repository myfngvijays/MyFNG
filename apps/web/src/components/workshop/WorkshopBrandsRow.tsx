'use client';

import type { WorkshopPublicPageBrand } from './types';

type WorkshopBrandsRowProps = {
  brands: WorkshopPublicPageBrand[];
};

export default function WorkshopBrandsRow({ brands }: WorkshopBrandsRowProps) {
  if (!brands.length) return null;

  return (
    <section
      className="py-10 text-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f8faff, #eef3fb)' }}
    >
      <div className="w-[90%] max-w-[1100px] mx-auto">
        <div className="mb-6">
          <span className="inline-block bg-[#e6edff] text-[#0a3d91] px-[18px] py-2 rounded-[30px] text-[13px] font-semibold mb-[15px]">
            ✨ Brands We Serve
          </span>
          <h2 className="text-[24px] sm:text-[36px] font-extrabold mb-[10px] text-[#0a3d91]">
            We Service All Major Car Brands
          </h2>
          <p className="text-[15px] text-[#666]">
            From Maruti to Mercedes, we&apos;ve got you covered
          </p>
        </div>

        <div className="overflow-hidden relative">
          <div className="flex gap-[30px] animate-scroll-brands">
            {[...brands, ...brands].map((brand, index) => (
              <div
                key={`brand-${index}`}
                className="min-w-[160px] h-[100px] bg-white rounded-2xl flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-[6px] hover:shadow-[0_15px_35px_rgba(0,0,0,0.12)] flex-shrink-0 group"
              >
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  className="max-w-[120px] max-h-[50px] object-contain transition-all duration-300 group-hover:scale-110"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.brand-fallback')) {
                      const fallback = document.createElement('span');
                      fallback.className =
                        'brand-fallback text-xs font-semibold text-gray-700 text-center px-2';
                      fallback.textContent = brand.name;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .animate-scroll-brands {
          animation: scrollBrands 25s linear infinite;
        }
        @keyframes scrollBrands {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @media (max-width: 768px) {
          .animate-scroll-brands > div {
            min-width: 130px;
            height: 80px;
          }
        }
      `}</style>
    </section>
  );
}
