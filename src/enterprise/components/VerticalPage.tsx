import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseCTA from './EnterpriseCTA';

interface Challenge {
  title: string;
  description: string;
}

interface UseCase {
  title: string;
  description: string;
}

interface MetricPreview {
  name: string;
  category: string;
}

interface VerticalPageProps {
  title: string;
  subtitle: string;
  heroDescription: string;
  challenges: Challenge[];
  solutionTitle: string;
  solutionDescription: string;
  solutionPoints: string[];
  useCases: UseCase[];
  metrics: MetricPreview[];
  ctaTitle?: string;
  ctaDescription?: string;
  metaTitle: string;
  metaDescription: string;
}

export default function VerticalPage({
  title,
  subtitle,
  heroDescription,
  challenges,
  solutionTitle,
  solutionDescription,
  solutionPoints,
  useCases,
  metrics,
  ctaTitle,
  ctaDescription,
  metaTitle,
  metaDescription,
}: VerticalPageProps) {
  useEffect(() => {
    document.title = `${metaTitle} | Walkability & Street Intelligence`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', metaDescription);
  }, [metaTitle, metaDescription]);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-3">{subtitle}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-enterprise-slate mb-6 leading-tight">{title}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">{heroDescription}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/enterprise/contact"
              className="px-8 py-3.5 bg-enterprise-green text-white font-semibold rounded-lg hover:bg-enterprise-green-light transition"
            >
              Request a Consultation
            </Link>
            <Link
              to="/enterprise/pricing"
              className="px-8 py-3.5 border-2 border-gray-300 text-enterprise-slate font-semibold rounded-lg hover:border-enterprise-navy transition"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* The Challenge */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-enterprise-slate mb-3">The Challenge</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Critical pedestrian infrastructure gaps that affect your decisions</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {challenges.map((c, i) => (
              <div key={i} className="bg-red-50/50 border border-red-100 rounded-xl p-6">
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-enterprise-slate mb-2">{c.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Solution */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-enterprise-slate mb-4">{solutionTitle}</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">{solutionDescription}</p>
              <ul className="space-y-3">
                {solutionPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-enterprise-green mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8">
              <h3 className="text-lg font-semibold text-enterprise-slate mb-6">Relevant Metrics</h3>
              <div className="space-y-4">
                {metrics.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-enterprise-gray rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-enterprise-navy" />
                    <div>
                      <p className="text-sm font-medium text-enterprise-slate">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.category}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/enterprise/metrics" className="inline-block mt-4 text-sm text-enterprise-navy font-medium hover:underline">
                View all 12 metrics &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-enterprise-slate mb-3">Use Cases</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {useCases.map((uc, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-enterprise-navy flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <h3 className="text-base font-semibold text-enterprise-slate">{uc.title}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <EnterpriseCTA
        dark
        title={ctaTitle}
        description={ctaDescription}
      />
    </>
  );
}
