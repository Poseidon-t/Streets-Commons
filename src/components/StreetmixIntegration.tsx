import { useState } from 'react';
import { COLORS } from '../constants';

interface StreetmixIntegrationProps {
  locationName: string;
}

export default function StreetmixIntegration({ locationName }: StreetmixIntegrationProps) {
  const [streetmixUrl, setStreetmixUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [street3DUrl, setStreet3DUrl] = useState('');

  const handleUrlChange = (url: string) => {
    setStreetmixUrl(url);

    // Validate Streetmix URL pattern: streetmix.net/username/number/street-name
    const streetmixPattern = /^https?:\/\/(?:www\.)?streetmix\.net\/([^\/]+)\/(\d+)\/([^\/]+)/;
    const match = url.match(streetmixPattern);

    if (match) {
      setIsValidUrl(true);
      setEmbedUrl(url);
      // Convert to 3DStreet URL
      setStreet3DUrl(url.replace('streetmix.net', 'streetmix3d.net'));
    } else {
      setIsValidUrl(false);
      setEmbedUrl('');
      setStreet3DUrl('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        🛣️ Visualize Street Redesign
      </h2>

      <p className="text-gray-600 mb-6">
        Design how {locationName} could look with better walkability infrastructure using{' '}
        <a
          href="https://streetmix.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline font-semibold"
        >
          Streetmix
        </a>
        . Create a street design, then paste the URL here to visualize it in 3D.
      </p>

      {/* URL Input */}
      <div className="mb-6">
        <label htmlFor="streetmix-url" className="block text-sm font-semibold text-gray-700 mb-2">
          Streetmix URL
        </label>
        <div className="flex gap-2">
          <input
            id="streetmix-url"
            type="url"
            value={streetmixUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://streetmix.net/username/123/street-name"
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
          {isValidUrl && (
            <button
              onClick={() => window.open(embedUrl, '_blank')}
              className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: COLORS.accent }}
            >
              Open
            </button>
          )}
        </div>
        {streetmixUrl && !isValidUrl && (
          <p className="text-sm text-red-600 mt-2">
            Please enter a valid Streetmix URL (e.g., https://streetmix.net/username/123/street-name)
          </p>
        )}
      </div>

      {/* Preview & 3D Link */}
      {isValidUrl && (
        <div className="space-y-4">
          {/* Streetmix Embed */}
          <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
            <iframe
              src={embedUrl}
              title="Streetmix Design"
              className="w-full h-96"
              frameBorder="0"
              allowFullScreen
            />
          </div>

          {/* 3DStreet Link */}
          <div className="flex justify-between items-center p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">View in 3D</h3>
              <p className="text-sm text-blue-700">
                See your street design in an immersive 3D environment
              </p>
            </div>
            <a
              href={street3DUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl font-semibold bg-blue-600 text-white transition-all hover:bg-blue-700 hover:shadow-lg"
            >
              Open 3DStreet →
            </a>
          </div>

          {/* How to Use */}
          <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm">💡 How to create your street design:</h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Visit <a href="https://streetmix.net" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Streetmix.net</a> and sign in with Twitter</li>
              <li>Design your ideal street with bike lanes, wider sidewalks, trees, etc.</li>
              <li>Save your design to get a shareable URL</li>
              <li>Paste the URL above to visualize it here</li>
              <li>Click "Open 3DStreet" to explore your design in 3D</li>
            </ol>
          </div>
        </div>
      )}

      {/* Call to Action (when no URL) */}
      {!streetmixUrl && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🏗️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Reimagine This Street
          </h3>
          <p className="text-gray-600 mb-4">
            Use Streetmix to design a safer, more walkable version of this street
          </p>
          <a
            href="https://streetmix.net/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg"
            style={{ backgroundColor: COLORS.primary }}
          >
            Create New Street Design
          </a>
        </div>
      )}
    </div>
  );
}
