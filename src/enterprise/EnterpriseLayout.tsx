import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  {
    label: 'Solutions',
    children: [
      { label: 'For Governments', href: '/enterprise/governments' },
      { label: 'For Real Estate', href: '/enterprise/real-estate' },
      { label: 'For Mobility', href: '/enterprise/mobility' },
      { label: 'For Research', href: '/enterprise/research' },
    ],
  },
  { label: 'How It Works', href: '/enterprise/how-it-works' },
  { label: 'Metrics', href: '/enterprise/metrics' },
  { label: 'Pricing', href: '/enterprise/pricing' },
];

export default function EnterpriseLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const location = useLocation();

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/enterprise" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-enterprise-navy flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-enterprise-slate">
              SafeStreets <span className="text-enterprise-navy">Intelligence</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setSolutionsOpen(true)}
                  onMouseLeave={() => setSolutionsOpen(false)}
                >
                  <button className="text-sm font-medium text-gray-600 hover:text-enterprise-navy transition flex items-center gap-1" aria-expanded={solutionsOpen} aria-haspopup="true">
                    {item.label}
                    <svg className={`w-4 h-4 transition ${solutionsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {solutionsOpen && (
                    <div className="absolute top-full left-0 pt-2">
                      <div className="bg-white rounded-xl shadow-lg border border-gray-100 py-2 min-w-[200px]">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={`block px-4 py-2.5 text-sm transition ${
                              isActive(child.href)
                                ? 'text-enterprise-navy bg-blue-50 font-medium'
                                : 'text-gray-600 hover:text-enterprise-navy hover:bg-gray-50'
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  to={item.href!}
                  className={`text-sm font-medium transition ${
                    isActive(item.href!)
                      ? 'text-enterprise-navy'
                      : 'text-gray-600 hover:text-enterprise-navy'
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
            <Link
              to="/"
              className="text-sm font-medium text-gray-600 hover:text-enterprise-navy transition"
            >
              Try Free Tool
            </Link>
            <Link
              to="/enterprise/contact"
              className="ml-2 px-5 py-2 bg-enterprise-navy text-white text-sm font-medium rounded-lg hover:bg-enterprise-navy-light transition"
            >
              Contact Sales
            </Link>
          </nav>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-1">
            {NAV_LINKS.map((item) =>
              item.children ? (
                <div key={item.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">{item.label}</p>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      to={child.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-3 py-2.5 rounded-lg text-sm ${
                        isActive(child.href)
                          ? 'text-enterprise-navy bg-blue-50 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.href}
                  to={item.href!}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm ${
                    isActive(item.href!)
                      ? 'text-enterprise-navy bg-blue-50 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Try Free Tool
            </Link>
            <Link
              to="/enterprise/contact"
              onClick={() => setMobileOpen(false)}
              className="block mt-3 text-center px-5 py-2.5 bg-enterprise-navy text-white text-sm font-medium rounded-lg"
            >
              Contact Sales
            </Link>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-enterprise-slate text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-enterprise-navy flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <span className="text-lg font-semibold">Walkability & Street Intelligence</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Interactive dashboards, in-depth field audits, and citizen advocacy intelligence for governments, developers, and urban planners.
              </p>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Solutions</h4>
              <ul className="space-y-2.5">
                <li><Link to="/enterprise/governments" className="text-sm text-gray-300 hover:text-white transition">For Governments</Link></li>
                <li><Link to="/enterprise/real-estate" className="text-sm text-gray-300 hover:text-white transition">For Real Estate</Link></li>
                <li><Link to="/enterprise/mobility" className="text-sm text-gray-300 hover:text-white transition">For Mobility</Link></li>
                <li><Link to="/enterprise/research" className="text-sm text-gray-300 hover:text-white transition">For Research</Link></li>
              </ul>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link to="/enterprise/how-it-works" className="text-sm text-gray-300 hover:text-white transition">How It Works</Link></li>
                <li><Link to="/enterprise/metrics" className="text-sm text-gray-300 hover:text-white transition">Metrics</Link></li>
                <li><Link to="/enterprise/pricing" className="text-sm text-gray-300 hover:text-white transition">Pricing</Link></li>
                <li><Link to="/enterprise/contact" className="text-sm text-gray-300 hover:text-white transition">Contact Sales</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Resources</h4>
              <ul className="space-y-2.5">
                <li><Link to="/" className="text-sm text-gray-300 hover:text-white transition">Free Street Safety Tool</Link></li>
                <li><Link to="/blog" className="text-sm text-gray-300 hover:text-white transition">Blog</Link></li>
                <li><Link to="/learn" className="text-sm text-gray-300 hover:text-white transition">Learn</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} SafeStreets. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="mailto:hello@safestreets.com" className="text-sm text-gray-400 hover:text-white transition">hello@safestreets.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
