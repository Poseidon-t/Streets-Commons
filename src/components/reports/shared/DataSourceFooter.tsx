/**
 * Data Source Footer Component
 * Professional citation and methodology documentation
 */

interface DataSourceFooterProps {
  sources: Array<{
    name: string;
    description?: string;
    url?: string;
  }>;
  methodology?: string;
  generatedAt?: Date;
}

export default function DataSourceFooter({
  sources,
  methodology,
  generatedAt = new Date()
}: DataSourceFooterProps) {
  return (
    <footer className="mt-8 pt-6 border-t-2 border-gray-200">
      {/* Methodology */}
      {methodology && (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
            Methodology
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">{methodology}</p>
        </div>
      )}

      {/* Data Sources */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
          Data Sources
        </h4>
        <div className="grid gap-2">
          {sources.map((source, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-emerald-500 mt-0.5">●</span>
              <div>
                <span className="font-medium text-gray-800">{source.name}</span>
                {source.description && (
                  <span className="text-gray-500"> — {source.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
        <p className="mb-2">
          <strong>Disclaimer:</strong> This report is generated using publicly available data and
          algorithmic analysis. While we strive for accuracy, actual conditions may vary.
          This report should be used as a planning guide, not as a substitute for professional
          on-site assessment.
        </p>
        <p>
          Report generated on {generatedAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })} by SafeStreets Professional Analysis.
        </p>
      </div>
    </footer>
  );
}

/**
 * Inline source citation
 */
export function SourceCitation({ source, year }: { source: string; year?: number }) {
  return (
    <span className="text-xs text-gray-400 italic">
      (Source: {source}{year ? `, ${year}` : ''})
    </span>
  );
}

/**
 * Data quality indicator
 */
export function DataQualityBadge({
  quality
}: {
  quality: 'high' | 'medium' | 'low' | 'estimated';
}) {
  const config = {
    high: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'High Confidence', icon: '✓' },
    medium: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium Confidence', icon: '◐' },
    low: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Low Confidence', icon: '◔' },
    estimated: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Estimated', icon: '~' }
  };

  const c = config[quality];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span>{c.icon}</span>
      {c.label}
    </span>
  );
}
