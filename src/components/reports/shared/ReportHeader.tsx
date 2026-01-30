/**
 * Shared Report Header Component
 * Professional header with branding, location, and date
 */

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  location: {
    displayName: string;
    lat: number;
    lon: number;
  };
  date?: Date;
  accentColor?: string;
}

export default function ReportHeader({
  title,
  subtitle,
  location,
  date = new Date(),
  accentColor = 'from-blue-600 to-blue-700'
}: ReportHeaderProps) {
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className={`bg-gradient-to-r ${accentColor} text-white p-6 rounded-t-2xl print:rounded-none`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-80 mb-1">
            SafeStreets Professional Analysis
          </div>
          <h1 className="text-3xl font-bold mb-1">{title}</h1>
          {subtitle && (
            <p className="text-lg opacity-90">{subtitle}</p>
          )}
        </div>
        <div className="text-right text-sm">
          <div className="opacity-80">Generated</div>
          <div className="font-semibold">{formattedDate}</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70">Location</div>
          <div className="font-medium">{location.displayName}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider opacity-70">Coordinates</div>
          <div className="font-mono text-sm">
            {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
          </div>
        </div>
      </div>
    </header>
  );
}
