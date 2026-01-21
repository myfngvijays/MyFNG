import { Clock } from 'lucide-react';

type WorkshopSidebarProps = {
  businessHours: Record<string, string>;
  viewsCount?: number | null;
  auditScore?: number | null;
};

export default function WorkshopSidebar({ businessHours, viewsCount, auditScore }: WorkshopSidebarProps) {
  const hasHours = Object.keys(businessHours || {}).some((day) => businessHours[day]);

  return (
    <aside className="space-y-6">
      {hasHours && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Business Hours
          </h3>
          <div className="space-y-2">
            {Object.entries(businessHours).map(([day, hours]) => {
              if (!hours) return null;
              return (
                <div key={day} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize font-medium">{day}</span>
                  <span className="text-gray-900">{hours}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-md p-6 text-white">
        <h3 className="text-lg font-bold mb-3 text-white">Book a Service</h3>
        <p className="text-blue-100 mb-4 text-sm">Get your vehicle serviced by our expert team</p>
        <a
          href="/book-service"
          className="block w-full text-center bg-white text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors"
        >
          Book Now
        </a>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">Statistics</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Page Views</span>
            <span className="font-semibold text-gray-900">{viewsCount || 0}</span>
          </div>
          {auditScore ? (
            <div className="flex justify-between">
              <span className="text-gray-600">Audit Score</span>
              <span className="font-semibold text-gray-900">{auditScore}/5</span>
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
