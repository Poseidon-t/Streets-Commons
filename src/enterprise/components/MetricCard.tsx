interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tier: 'core' | 'complete';
}

export default function MetricCard({ icon, title, description, tier }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-enterprise-navy flex items-center justify-center group-hover:bg-enterprise-navy group-hover:text-white transition">
          {icon}
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          tier === 'core'
            ? 'bg-blue-50 text-enterprise-navy'
            : 'bg-emerald-50 text-enterprise-green'
        }`}>
          {tier === 'core' ? '$50K+' : '$100K'}
        </span>
      </div>
      <h3 className="text-base font-semibold text-enterprise-slate mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
