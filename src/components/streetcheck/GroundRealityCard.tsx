import type { GroundRealityNarrative, MapillaryIntelligence, SatelliteVisionAnalysis } from '../../types';

interface GroundRealityCardProps {
  narrative: GroundRealityNarrative | null;
  narrativeLoading: boolean;
  mapillary: MapillaryIntelligence | null;
  mapillaryLoading: boolean;
  satelliteVision: SatelliteVisionAnalysis | null;
}

function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      className="h-3 rounded animate-pulse"
      style={{ backgroundColor: '#e8e3d8', width }}
    />
  );
}

function GroundRealityCardSkeleton() {
  return (
    <div
      className="rounded-2xl border mt-8"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: '#f0ebe0' }}>
        <div className="h-4 w-44 rounded animate-pulse" style={{ backgroundColor: '#e8e3d8' }} />
      </div>
      <div className="px-5 pt-4 pb-3 space-y-2.5">
        <SkeletonLine />
        <SkeletonLine width="93%" />
        <SkeletonLine width="86%" />
        <SkeletonLine width="72%" />
      </div>
      <div className="px-5 pb-5 space-y-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 animate-pulse" style={{ backgroundColor: '#e0dbd0' }} />
            <SkeletonLine width={`${[82, 74, 68][i]}%`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: '#f0ebe0', color: '#5a6a5a' }}
    >
      {label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const styles = {
    high:   { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  text: '#15803d' },
    medium: { bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.30)',  text: '#854d0e' },
    low:    { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)',  text: '#991b1b' },
  };
  const s = styles[confidence];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}
    >
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
    </span>
  );
}

function PhotoThumbnail({ url, capturedAt }: { url: string; capturedAt: string }) {
  const year = capturedAt ? new Date(capturedAt).getFullYear() : null;
  return (
    <div
      className="relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border"
      style={{ borderColor: '#e0dbd0' }}
    >
      <img
        src={url}
        alt="Street view"
        className="w-full h-full object-cover"
        loading="lazy"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      {year && (
        <div
          className="absolute bottom-0.5 right-0.5 text-[9px] px-1 rounded"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: 'white' }}
        >
          {year}
        </div>
      )}
    </div>
  );
}

export default function GroundRealityCard({
  narrative,
  narrativeLoading,
  mapillary,
  mapillaryLoading,
  satelliteVision,
}: GroundRealityCardProps) {
  if (narrativeLoading || mapillaryLoading) {
    return <GroundRealityCardSkeleton />;
  }

  if (!narrative) return null;

  const photos = mapillary?.coverage ? mapillary.photos.slice(0, 3) : [];

  const satelliteRows: { label: string; value: string }[] = satelliteVision
    ? [
        { label: 'Parking', value: satelliteVision.parkingCoverage },
        { label: 'Building density', value: satelliteVision.buildingDensity },
        { label: 'Green cover', value: satelliteVision.greenCoverage },
      ]
    : [];

  return (
    <div
      className="rounded-2xl border mt-8"
      style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: '#f0ebe0' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🗺</span>
          <span className="text-base font-bold" style={{ color: '#2a3a2a' }}>
            Ground Reality
          </span>
        </div>
        <ConfidenceBadge confidence={narrative.confidence} />
      </div>

      {/* Narrative */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-sm leading-relaxed" style={{ color: '#3a4a3a' }}>
          {narrative.narrative}
        </p>
      </div>

      {/* Key insights */}
      <div className="px-5 pb-4 space-y-2">
        {narrative.keyInsights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: '#e07850' }}
            />
            <span className="text-sm" style={{ color: '#3a4a3a' }}>{insight}</span>
          </div>
        ))}
      </div>

      {/* Mapillary photo strip */}
      {photos.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo, i) => (
              <PhotoThumbnail key={i} url={photo.url} capturedAt={photo.capturedAt} />
            ))}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: '#b0a8a0' }}>
            Street photos: Mapillary (open data, Meta) · {mapillary?.imageCount} images in area
          </p>
        </div>
      )}

      {/* Satellite detail row */}
      {satelliteRows.length > 0 && (
        <div
          className="mx-5 mb-4 rounded-xl p-3.5 grid grid-cols-3 gap-2"
          style={{ backgroundColor: '#f8f6f1' }}
        >
          {satelliteRows.map(({ label, value }) => (
            <div key={label}>
              <div
                className="text-xs font-semibold uppercase mb-0.5"
                style={{ color: '#8a9a8a', letterSpacing: '0.06em' }}
              >
                {label}
              </div>
              <div className="text-sm font-medium capitalize" style={{ color: '#2a3a2a' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data source footer */}
      <div className="px-5 pb-4 flex flex-wrap items-center gap-1.5">
        {narrative.dataSources.map(src => (
          <SourceBadge key={src} label={src} />
        ))}
      </div>
    </div>
  );
}
