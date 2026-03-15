import { Link } from 'react-router-dom';

interface PlatformCTAProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  dark?: boolean;
}

export default function PlatformCTA({
  title = 'Ready to build your street intelligence platform?',
  description = 'Custom dashboards, decisioning workflows, and API access  -  configured for how your organization makes decisions.',
  primaryLabel = 'Contact Sales',
  primaryHref = '/platform/contact',
  secondaryLabel = 'View Pricing',
  secondaryHref = '/platform/pricing',
  dark = false,
}: PlatformCTAProps) {
  return (
    <section className={`py-20 ${dark ? 'bg-platform-slate' : 'bg-platform-gray'}`}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${dark ? 'text-white' : 'text-platform-slate'}`}>
          {title}
        </h2>
        <p className={`text-lg mb-8 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={primaryHref}
            className="px-8 py-3.5 bg-platform-green text-white font-semibold rounded-lg hover:bg-platform-green-light transition text-center"
          >
            {primaryLabel}
          </Link>
          <Link
            to={secondaryHref}
            className={`px-8 py-3.5 font-semibold rounded-lg border-2 transition text-center ${
              dark
                ? 'border-gray-600 text-white hover:border-gray-400'
                : 'border-gray-300 text-platform-slate hover:border-platform-navy'
            }`}
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
