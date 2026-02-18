import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PROJECT_TYPES = [
  'Municipal Planning & Policy',
  'Real Estate Development',
  'Transit & Mobility Planning',
  'Academic Research',
  'Community Advocacy',
  'Other',
];

const BUDGET_RANGES = [
  '$50K — Street Intelligence',
  '$100K — Complete Street Intelligence',
  'Not sure yet',
];

const TIMELINES = [
  'Within 1 month',
  '1-3 months',
  '3-6 months',
  'Just exploring',
];

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Contact Sales | Walkability & Street Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Get in touch with Walkability & Street Intelligence. Request a consultation for dashboards, field audits, and citizen advocacy for your project.');
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      location: formData.get('location') as string || 'Not specified',
      projectType: formData.get('projectType') as string,
      description: [
        `Organization: ${formData.get('organization') || 'Not specified'}`,
        `Role: ${formData.get('role') || 'Not specified'}`,
        `Budget: ${formData.get('budget') || 'Not specified'}`,
        `Timeline: ${formData.get('timeline') || 'Not specified'}`,
        ``,
        `Message:`,
        formData.get('message') as string,
      ].join('\n'),
      timeline: formData.get('timeline') as string || 'Not specified',
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/contact-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to send. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section className="py-32">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 text-enterprise-green flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-enterprise-slate mb-3">Thank you</h1>
          <p className="text-gray-600 mb-8">We've received your inquiry and will be in touch within 1-2 business days to discuss your project.</p>
          <Link to="/enterprise" className="text-enterprise-navy font-medium hover:underline">&larr; Back to Walkability & Street Intelligence</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-enterprise-gray py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 md:gap-16">
            {/* Left — Info */}
            <div className="md:col-span-2">
              <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-3">Contact Sales</p>
              <h1 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-4">Let's discuss your project</h1>
              <p className="text-gray-600 mb-10 leading-relaxed">
                Tell us about your pedestrian safety intelligence needs and we'll put together a tailored proposal for your project.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-enterprise-slate mb-1">What happens next?</h3>
                  <ul className="space-y-2.5 mt-3">
                    {[
                      'We review your project details',
                      'Schedule a 30-min consultation call',
                      'Deliver a tailored proposal within a week',
                    ].map((step, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="w-6 h-6 rounded-full bg-blue-50 text-enterprise-navy text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Or email us directly at</p>
                  <a href="mailto:hello@safestreets.com" className="text-enterprise-navy font-medium hover:underline">
                    hello@safestreets.com
                  </a>
                </div>
              </div>
            </div>

            {/* Right — Form */}
            <div className="md:col-span-3">
              <form onSubmit={handleSubmit} className="bg-enterprise-gray rounded-2xl p-8 space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                    <input name="name" required className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                    <input name="email" type="email" required className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization</label>
                    <input name="organization" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <input name="role" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Type *</label>
                  <select name="projectType" required className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy">
                    <option value="">Select project type</option>
                    {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Location / City</label>
                  <input name="location" placeholder="e.g., Austin, TX" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy" />
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget Range</label>
                    <select name="budget" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy">
                      <option value="">Select budget</option>
                      {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Timeline</label>
                    <select name="timeline" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy">
                      <option value="">Select timeline</option>
                      {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tell us about your project *</label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    placeholder="What are your pedestrian safety intelligence needs? Are you interested in dashboard analytics, field audits, citizen advocacy, or all three?"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-navy/20 focus:border-enterprise-navy resize-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-enterprise-navy text-white font-semibold rounded-lg hover:bg-enterprise-navy-light transition disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send Inquiry'}
                </button>
                <p className="text-xs text-gray-400 text-center">We'll respond within 1-2 business days.</p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
