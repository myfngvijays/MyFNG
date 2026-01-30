import type { WorkshopPublicPageBrand } from './types';

type WorkshopBrandsRowProps = {
  brands: WorkshopPublicPageBrand[];
};

export default function WorkshopBrandsRow({ brands }: WorkshopBrandsRowProps) {
  if (!brands.length) return null;

  return (
    <section className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">BRANDS WE SERVE</h3>
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 shadow-sm overflow-hidden">
        <div className="flex gap-4 sm:gap-5 md:gap-6 animate-scroll-horizontal">
          {brands.map((brand, index) => (
            <div
              key={`brand-1-${brand.name}-${index}`}
              className="flex items-center justify-center min-w-[120px] sm:min-w-[130px] md:min-w-[140px] h-16 sm:h-18 md:h-20 bg-white rounded-full shadow-sm border border-gray-200 flex-shrink-0 group relative px-4"
            >
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="object-contain w-full h-full max-w-[120px] max-h-[40px] group-hover:scale-110 transition-transform"
                loading="eager"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.brand-fallback')) {
                    const fallback = document.createElement('span');
                    fallback.className = 'brand-fallback text-xs font-semibold text-gray-700 text-center px-2';
                    fallback.textContent = brand.name;
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
          ))}
          {brands.map((brand, index) => (
            <div
              key={`brand-2-${brand.name}-${index}`}
              className="flex items-center justify-center min-w-[120px] sm:min-w-[130px] md:min-w-[140px] h-16 sm:h-18 md:h-20 bg-white rounded-full shadow-sm border border-gray-200 flex-shrink-0 group relative px-4"
            >
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="object-contain w-full h-full max-w-[120px] max-h-[40px] group-hover:scale-110 transition-transform"
                loading="eager"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.brand-fallback')) {
                    const fallback = document.createElement('span');
                    fallback.className = 'brand-fallback text-xs font-semibold text-gray-700 text-center px-2';
                    fallback.textContent = brand.name;
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
