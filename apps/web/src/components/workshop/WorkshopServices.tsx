import { CheckCircle } from 'lucide-react';

type WorkshopServicesProps = {
  services: string[];
};

export default function WorkshopServices({ services }: WorkshopServicesProps) {
  if (!services.length) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Services Offered</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map((service, index) => (
          <div key={`${service}-${index}`} className="flex items-start gap-2 text-gray-700">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>{service}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
