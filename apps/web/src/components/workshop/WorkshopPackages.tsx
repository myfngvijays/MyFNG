import type { WorkshopPublicPagePackage } from './types';

type WorkshopPackagesProps = {
  packages: WorkshopPublicPagePackage[];
};

export default function WorkshopPackages({ packages }: WorkshopPackagesProps) {
  if (!packages.length) return null;

  return (
    <section className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Periodic Service Packages</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packages.map((pkg, index) => (
          <div key={`${pkg.name}-${index}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">{pkg.name}</h4>
              {pkg.price ? (
                <span className="text-xs font-semibold text-blue-700">{pkg.price}</span>
              ) : null}
            </div>
            {pkg.features?.length ? (
              <ul className="text-xs text-gray-600 space-y-2">
                {pkg.features.map((feature, featureIndex) => (
                  <li key={`${pkg.name}-feature-${featureIndex}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">Details coming soon.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
