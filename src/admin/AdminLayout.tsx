import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import AdminGuard from './AdminGuard';

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/crm', label: 'Sales CRM', end: false },
  { to: '/admin/content-queue', label: 'Content Queue', end: false },
  { to: '/admin/blog', label: 'Blog Posts', end: false },
  { to: '/admin/infographics', label: 'Infographics', end: false },
  { to: '/admin/sketch', label: 'Sketch Lab', end: false },
  { to: '/admin/theme', label: 'Landing Theme', end: false },
];

export default function AdminLayout() {
  return (
    <AdminGuard>
      <div className="min-h-screen flex" style={{ backgroundColor: '#f5f5f5' }}>
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#1a2a1a' }}>
          <div className="p-5 border-b border-white/10">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="SafeStreets logo" style={{ width: 28, height: 28 }} />
              <span className="text-lg font-bold" style={{ color: '#e07850' }}>
                Admin
              </span>
            </a>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10 flex items-center gap-3">
            <UserButton />
            <a
              href="/"
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Back to site
            </a>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  );
}
