import { Link } from 'react-router-dom';

interface EnterpriseCTAProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  dark?: boolean;
}

export default function EnterpriseCTA({
  title = 'Ready to understand your walkability?',
  description = 'Get a comprehensive walkability intelligence report tailored to your project needs.',
  primaryLabel = 'Contact Sales',
  primaryHref = '/enterprise/contact',
  secondaryLabel = 'View Pricing',
  secondaryHref = '/enterprise/pricing',
  dark = false,
}: EnterpriseCTAProps) {
  return (
    <section className={`py-20 ${dark ? 'bg-enterprise-slate' : 'bg-enterprise-gray'}`}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${dark ? 'text-white' : 'text-enterprise-slate'}`}>
          {title}
        </h2>
        <p className={`text-lg mb-8 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={primaryHref}
            className="px-8 py-3.5 bg-enterprise-green text-white font-semibold rounded-lg hover:bg-enterprise-green-light transition text-center"
          >
            {primaryLabel}
          </Link>
          <Link
            to={secondaryHref}
            className={`px-8 py-3.5 font-semibold rounded-lg border-2 transition text-center ${
              dark
                ? 'border-gray-600 text-white hover:border-gray-400'
                : 'border-gray-300 text-enterprise-slate hover:border-enterprise-navy'
            }`}
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
