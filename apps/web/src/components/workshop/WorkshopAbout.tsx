type WorkshopAboutProps = {
  description?: string | null;
};

export default function WorkshopAbout({ description }: WorkshopAboutProps) {
  if (!description) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">About Us</h2>
      <div className="prose max-w-none text-gray-700 whitespace-pre-line">{description}</div>
    </section>
  );
}
