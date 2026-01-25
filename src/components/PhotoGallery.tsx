import { useState } from 'react';
import type { MapillaryImage } from '../services/mapillary';
import { getMapillaryViewerUrl, isMapillaryConfigured } from '../services/mapillary';
import { COLORS } from '../constants';

interface PhotoGalleryProps {
  images: MapillaryImage[];
  locationName: string;
}

export default function PhotoGallery({ images, locationName }: PhotoGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<MapillaryImage | null>(null);

  // Show configuration message if Mapillary not configured
  if (!isMapillaryConfigured()) {
    return (
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📷 Street-Level Photos</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Mapillary Integration Available</strong>
            <br />
            Add your free Mapillary access token to view street-level photos from the community.
            <br />
            <a
              href="https://www.mapillary.com/dashboard/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-700"
            >
              Get your token →
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no photos available
  if (images.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📷 Street-Level Photos</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-gray-700 font-semibold mb-2">
            No street-level photos available for this area
          </p>
          <p className="text-sm text-gray-600">
            {locationName} does not have Mapillary imagery coverage yet.
            <br />
            You can contribute photos using the Mapillary mobile app.
          </p>
          <a
            href="https://www.mapillary.com/mobile-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{ backgroundColor: COLORS.accent }}
          >
            Learn More →
          </a>
        </div>
      </div>
    );
  }

  // Show gallery with photos
  return (
    <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
      <h3 className="text-xl font-bold text-gray-800 mb-2">
        📷 Street-Level Photos ({images.length})
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Community-contributed photos from Mapillary showing actual street conditions
      </p>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.slice(0, 12).map((image) => {
          const capturedDate = new Date(image.capturedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
          });

          return (
            <div
              key={image.id}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border-2 border-gray-200 hover:border-orange-400"
              onClick={() => setSelectedImage(image)}
            >
              {image.thumb256Url ? (
                <img
                  src={image.thumb256Url}
                  alt={`Street view from ${capturedDate}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-4xl">📷</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-2 py-1">
                {capturedDate}
              </div>
            </div>
          );
        })}
      </div>

      {images.length > 12 && (
        <p className="text-sm text-gray-500 mt-3 text-center">
          Showing 12 of {images.length} photos available
        </p>
      )}

      {/* View all on Mapillary */}
      <div className="mt-4 text-center">
        <a
          href={`https://www.mapillary.com/app/?focus=map&lat=${images[0].lat}&lng=${images[0].lon}&z=16`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        >
          View All on Mapillary →
        </a>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
            >
              ✕
            </button>

            {/* Full-size image */}
            {selectedImage.thumb2048Url && (
              <img
                src={selectedImage.thumb2048Url}
                alt="Street view"
                className="w-full rounded-lg"
              />
            )}

            {/* Image info */}
            <div className="bg-white rounded-b-lg p-4 space-y-2">
              <p className="text-sm text-gray-600">
                Captured:{' '}
                {new Date(selectedImage.capturedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <a
                href={getMapillaryViewerUrl(selectedImage.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: COLORS.primary }}
              >
                View in Mapillary →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
