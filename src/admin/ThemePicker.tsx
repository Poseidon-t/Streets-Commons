import { useState, useEffect } from 'react';
import { useAdminApi } from './adminApi';

const THEMES = [
  {
    id: 'A',
    name: 'Black + Red',
    desc: 'Raw, protest-poster energy',
    bg: '#1a1008',
    accent: '#b83218',
    light: '#f2ede4',
  },
  {
    id: 'B',
    name: 'Forest + Amber',
    desc: 'Natural, civic, grounded',
    bg: '#14261a',
    accent: '#d49b0a',
    light: '#f5f0e4',
  },
  {
    id: 'C',
    name: 'Navy + Vermillion',
    desc: 'Authoritative meets passionate',
    bg: '#0d1e38',
    accent: '#e05530',
    light: '#f4f0eb',
  },
  {
    id: 'D',
    name: 'Charcoal + Copper',
    desc: 'Sophisticated, aged bronze',
    bg: '#1e1e1e',
    accent: '#b5622a',
    light: '#f7f2ea',
  },
];

export default function ThemePicker() {
  const { adminFetch } = useAdminApi();
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/landing-theme')
      .then(r => r.json())
      .then(d => setCurrent(d.theme))
      .catch(() => setCurrent('A'));
  }, []);

  async function selectTheme(id: string) {
    if (id === current || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await adminFetch('/api/admin/landing-theme', {
        method: 'POST',
        body: JSON.stringify({ theme: id }),
      });
      setCurrent(id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save theme');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Landing Page Theme</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Choose the colour theme for <strong>streetsandcommons.com</strong>. Changes apply immediately  -  no redeploy needed.
        </p>
      </div>

      {saved && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          Theme saved  -  live on the site now.
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
        {THEMES.map((t) => {
          const isActive = current === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTheme(t.id)}
              disabled={saving}
              className="text-left rounded-xl overflow-hidden border-2 transition-all focus:outline-none"
              style={{
                borderColor: isActive ? t.accent : 'transparent',
                boxShadow: isActive ? `0 0 0 3px ${t.accent}22` : '0 1px 4px rgba(0,0,0,0.08)',
                opacity: saving && !isActive ? 0.6 : 1,
              }}
            >
              {/* Mini preview */}
              <div style={{ background: t.bg, padding: '1.25rem 1.5rem', position: 'relative', minHeight: '110px' }}>
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: '35%', height: '100%',
                  background: t.accent, clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: 'Helvetica, sans-serif', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.accent, marginBottom: '0.5rem' }}>
                    Streets & Commons Lab
                  </div>
                  <div style={{ fontFamily: 'Helvetica, sans-serif', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: t.light, lineHeight: 1.0, marginBottom: '0.75rem' }}>
                    THE STREET<br />BELONGS TO<br /><span style={{ color: t.accent }}>EVERYONE.</span>
                  </div>
                  <div style={{ display: 'inline-block', background: t.accent, color: t.light, fontFamily: 'Helvetica, sans-serif', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.3rem 0.7rem' }}>
                    Try SafeStreets →
                  </div>
                </div>
              </div>

              {/* Label row */}
              <div className="bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.bg, border: '1px solid #e5e7eb' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.accent }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.light, border: '1px solid #e5e7eb' }} />
                  {isActive && (
                    <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: t.accent + '1a', color: t.accent }}>
                      Active
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
