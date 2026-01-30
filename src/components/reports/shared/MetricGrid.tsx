/**
 * Metric Grid Component
 * Joyful, visual metric cards with icons and progress indicators
 * Inspired by joyful infographics - colorful, expressive, data-storytelling
 */

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: 'blue' | 'green' | 'amber' | 'orange' | 'red' | 'purple' | 'gray';
  trend?: 'up' | 'down' | 'neutral';
}

const colorClasses = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', accent: 'bg-red-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', accent: 'bg-gray-500' }
};

export function MetricCard({ icon, label, value, sublabel, color = 'blue', trend }: MetricCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 relative overflow-hidden`}>
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.accent}`} />

      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
          <div className={`text-2xl font-bold ${colors.text} flex items-center gap-2`}>
            {value}
            {trend && (
              <span className={`text-sm ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </div>
          {sublabel && <div className="text-sm text-gray-600 mt-1">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}

interface MetricGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export default function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {children}
    </div>
  );
}

/**
 * Progress metric with visual bar
 */
export function ProgressMetric({
  label,
  value,
  max = 100,
  unit = '%',
  icon,
  color = 'blue'
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  icon?: string;
  color?: keyof typeof colorClasses;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const colors = colorClasses[color];

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon && <span className="text-lg">{icon}</span>}
          {label}
        </span>
        <span className={`font-bold ${colors.text}`}>
          {value}{unit}
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.accent} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Stat highlight for important numbers
 */
export function StatHighlight({
  value,
  label,
  icon,
  size = 'md'
}: {
  value: string | number;
  label: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: { value: 'text-xl', label: 'text-xs', icon: 'text-2xl' },
    md: { value: 'text-3xl', label: 'text-sm', icon: 'text-3xl' },
    lg: { value: 'text-5xl', label: 'text-base', icon: 'text-4xl' }
  };

  const s = sizes[size];

  return (
    <div className="text-center p-4">
      {icon && <div className={`${s.icon} mb-2`}>{icon}</div>}
      <div className={`${s.value} font-bold text-gray-800`}>{value}</div>
      <div className={`${s.label} text-gray-500 uppercase tracking-wider mt-1`}>{label}</div>
    </div>
  );
}

/**
 * Comparison bars for before/after or multiple items
 */
export function ComparisonBars({
  items
}: {
  items: Array<{
    label: string;
    value: number;
    max?: number;
    color?: keyof typeof colorClasses;
  }>;
}) {
  const maxValue = Math.max(...items.map(i => i.max || i.value));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">{item.label}</span>
            <span className={`font-bold ${colorClasses[item.color || 'blue'].text}`}>
              {item.value}
            </span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colorClasses[item.color || 'blue'].accent} rounded-full`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
