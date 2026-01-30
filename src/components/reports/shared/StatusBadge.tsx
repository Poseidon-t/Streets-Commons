/**
 * Status Badge Components
 * Joyful, expressive status indicators
 */

type StatusType = 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'available' | 'unavailable';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig: Record<StatusType, {
  bg: string;
  text: string;
  border: string;
  icon: string;
  defaultLabel: string;
}> = {
  excellent: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    icon: '✨',
    defaultLabel: 'Excellent'
  },
  good: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    icon: '👍',
    defaultLabel: 'Good'
  },
  fair: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: '🤔',
    defaultLabel: 'Fair'
  },
  poor: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    icon: '⚠️',
    defaultLabel: 'Needs Improvement'
  },
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: '🚨',
    defaultLabel: 'Critical'
  },
  available: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    icon: '✓',
    defaultLabel: 'Available'
  },
  unavailable: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '✗',
    defaultLabel: 'Not Available'
  }
};

export default function StatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true
}: StatusBadgeProps) {
  const config = statusConfig[status];

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bg} ${config.text} ${config.border} ${sizes[size]}`}>
      {showIcon && <span>{config.icon}</span>}
      {label || config.defaultLabel}
    </span>
  );
}

/**
 * Score-based status badge
 */
export function ScoreStatus({ score, label }: { score: number; label?: string }) {
  let status: StatusType;
  if (score >= 80) status = 'excellent';
  else if (score >= 60) status = 'good';
  else if (score >= 40) status = 'fair';
  else if (score >= 20) status = 'poor';
  else status = 'critical';

  return <StatusBadge status={status} label={label} />;
}

/**
 * Boolean availability indicator
 */
export function AvailabilityBadge({
  available,
  availableLabel = 'Available',
  unavailableLabel = 'Not Available'
}: {
  available: boolean;
  availableLabel?: string;
  unavailableLabel?: string;
}) {
  return (
    <StatusBadge
      status={available ? 'available' : 'unavailable'}
      label={available ? availableLabel : unavailableLabel}
    />
  );
}

/**
 * Severity indicator for violations/issues
 */
export function SeverityBadge({
  severity,
  count
}: {
  severity: 'high' | 'medium' | 'low';
  count?: number;
}) {
  const config = {
    high: { bg: 'bg-red-500', text: 'text-white', label: 'High Priority', icon: '🔴' },
    medium: { bg: 'bg-orange-500', text: 'text-white', label: 'Medium', icon: '🟠' },
    low: { bg: 'bg-yellow-500', text: 'text-gray-900', label: 'Low', icon: '🟡' }
  };

  const c = config[severity];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${c.bg} ${c.text}`}>
      <span>{c.icon}</span>
      {c.label}
      {count !== undefined && <span className="ml-1">({count})</span>}
    </span>
  );
}

/**
 * Pill group for multiple status items
 */
export function StatusPillGroup({
  items
}: {
  items: Array<{ label: string; available: boolean; icon?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
            item.available
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
          <span className={item.available ? 'text-emerald-500' : 'text-gray-300'}>
            {item.available ? '✓' : '✗'}
          </span>
        </div>
      ))}
    </div>
  );
}
