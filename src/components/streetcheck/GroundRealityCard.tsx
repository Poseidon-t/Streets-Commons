import type { GroundRealityNarrative, MapillaryIntelligence, SatelliteVisionAnalysis } from '../../types';

interface GroundRealityCardProps {
  narrative: GroundRealityNarrative | null;
  narrativeLoading: boolean;
  mapillary: MapillaryIntelligence | null;
  mapillaryLoading: boolean;
  satelliteVision: SatelliteVisionAnalysis | null;
}

function GroundRealityCardSkeleton() {
  return (
    <div className="retro-card">
      <div className="retro-card-header">
        <span className="retro-card-header-title">Ground Reality · Field Observation</span>
      </div>
      <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[100, 93, 86, 72].map((w, i) => (
          <div key={i} className="animate-pulse" style={{ height: 11, width: `${w}%`, background: '#d8d0c4' }} />
        ))}
      </div>
      <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[82, 74, 68].map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div className="animate-pulse" style={{ width: 10, height: 10, background: '#c4b59a', flexShrink: 0, marginTop: 1 }} />
            <div className="animate-pulse" style={{ height: 10, width: `${w}%`, background: '#d8d0c4' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoThumbnail({ url, capturedAt }: { url: string; capturedAt: string }) {
  const year = capturedAt ? new Date(capturedAt).getFullYear() : null;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: 88, height: 58, border: '1px solid #c4b59a', overflow: 'hidden' }}>
      <img
        src={url}
        alt="Street view"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      {year && (
        <div style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', padding: '1px 3px', background: 'rgba(0,0,0,0.55)', color: 'white' }}>
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
        { label: 'Parking',          value: satelliteVision.parkingCoverage },
        { label: 'Building density', value: satelliteVision.buildingDensity },
        { label: 'Green cover',      value: satelliteVision.greenCoverage },
      ]
    : [];

  const confColor = narrative.confidence === 'high' ? '#2a5224' : narrative.confidence === 'medium' ? '#d4920c' : '#b8401a';

  return (
    <div className="retro-card">
      {/* Header */}
      <div className="retro-card-header">
        <span className="retro-card-header-title">🗺 Ground Reality · Field Observation</span>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          padding: '3px 8px', border: `1.5px solid ${confColor}`, color: confColor,
        }}>
          {narrative.confidence} confidence
        </span>
      </div>

      {/* Narrative */}
      <div style={{ padding: '16px 16px 10px' }}>
        <p style={{ fontSize: 12, lineHeight: 1.7, color: '#3d2f18', fontStyle: 'italic' }}>
          {narrative.narrative}
        </p>
      </div>

      {/* Key insights with → bullets */}
      <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {narrative.keyInsights.map((insight, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#b8401a', lineHeight: 1.3, flexShrink: 0, fontFamily: 'Georgia, serif' }}>→</span>
            <span style={{ fontSize: 11, color: '#3d2f18', lineHeight: 1.5 }}>{insight}</span>
          </div>
        ))}
      </div>

      {/* Photo strip */}
      {photos.length > 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {photos.map((photo, i) => (
              <PhotoThumbnail key={i} url={photo.url} capturedAt={photo.capturedAt} />
            ))}
          </div>
          <p style={{ marginTop: 5, fontSize: 9, color: '#8a7a60', letterSpacing: '0.04em' }}>
            Mapillary (open data, Meta) · {mapillary?.imageCount} images in area
          </p>
        </div>
      )}

      {/* Satellite detail */}
      {satelliteRows.length > 0 && (
        <div style={{ margin: '0 16px 14px', border: '1px solid #c4b59a', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {satelliteRows.map(({ label, value }, i) => (
            <div key={label} style={{ padding: '8px 10px', borderRight: i < 2 ? '1px solid #c4b59a' : 'none' }}>
              <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#8a7a60', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#1e1608' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data sources */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {narrative.dataSources.map(src => (
          <span key={src} style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#5c4a2c', padding: '2px 6px', border: '1px solid #c4b59a' }}>
            {src}
          </span>
        ))}
      </div>
    </div>
  );
}
