import type { WorkshopPublicPage, Workshop } from './types';

type WorkshopCoverProps = {
  page: WorkshopPublicPage;
  workshop: Workshop;
};

export default function WorkshopCover({ page, workshop }: WorkshopCoverProps) {
  if (!page.cover_image) return null;

  return (
    <section className="relative w-full h-64 sm:h-72 md:h-96 bg-gray-200">
      <img
        src={page.cover_image}
        alt={workshop.name || 'Workshop cover'}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
    </section>
  );
}
