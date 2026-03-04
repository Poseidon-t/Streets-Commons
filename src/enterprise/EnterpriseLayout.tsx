import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function EnterpriseLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/enterprise" className="flex items-center gap-2">
            <img src="/logo.svg" alt="SafeStreets logo" className="w-9 h-9" />
            <span className="text-lg font-semibold text-enterprise-slate">
              SafeStreets <span className="text-enterprise-navy">Intelligence</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-gray-600 hover:text-enterprise-navy transition">
              Try Free Tool
            </Link>
            <Link
              to="/enterprise/contact"
              className="px-5 py-2 bg-enterprise-navy text-white text-sm font-medium rounded-lg hover:bg-enterprise-navy-dark transition"
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
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-2">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Try Free Tool
            </Link>
            <Link to="/enterprise/contact" onClick={() => setMobileOpen(false)} className="block text-center px-5 py-2.5 bg-enterprise-navy text-white text-sm font-medium rounded-lg">
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
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} SafeStreets. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm text-gray-400 hover:text-white transition">Free Tool</Link>
            <Link to="/enterprise/contact" className="text-sm text-gray-400 hover:text-white transition">Contact Sales</Link>
            <a href="mailto:hello@streetsandcommons.com" className="text-sm text-gray-400 hover:text-white transition">hello@streetsandcommons.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
