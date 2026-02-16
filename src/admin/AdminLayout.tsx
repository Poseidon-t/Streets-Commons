import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import AdminGuard from './AdminGuard';

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/content-queue', label: 'Content Queue', end: false },
  { to: '/admin/blog', label: 'Blog Posts', end: false },
  { to: '/admin/emails', label: 'Email Captures', end: false },
];

export default function AdminLayout() {
  return (
    <AdminGuard>
      <div className="min-h-screen flex" style={{ backgroundColor: '#f5f5f5' }}>
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#2a3a2a' }}>
          <div className="p-5 border-b border-white/10">
            <a href="/" className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 44 44">
                <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850" />
                <rect x="10" y="14" width="6" height="16" fill="white" rx="1" />
                <rect x="19" y="14" width="6" height="16" fill="white" rx="1" />
                <rect x="28" y="14" width="6" height="16" fill="white" rx="1" />
              </svg>
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
