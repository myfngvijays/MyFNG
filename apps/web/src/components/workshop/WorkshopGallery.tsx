type WorkshopGalleryProps = {
  images: string[];
  onImageClick: (index: number) => void;
};

export default function WorkshopGallery({ images, onImageClick }: WorkshopGalleryProps) {
  if (!images.length) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Gallery</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((imageUrl, index) => (
          <button
            key={`${imageUrl}-${index}`}
            type="button"
            className="aspect-square rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => onImageClick(index)}
            aria-label={`Open gallery image ${index + 1}`}
          >
            <img
              src={imageUrl}
              alt={`Gallery ${index + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
