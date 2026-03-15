/**
 * Streets & Commons Lab  -  landing page
 * Served at streetsandcommons.com
 */

import { useState, useEffect } from 'react';

const SAFESTREETS_URL = 'https://safestreets.streetsandcommons.com';
const CONTACT_EMAIL = 'hello@streetsandcommons.com';

type Theme = {
  bg: string; accent: string; light: string; lightAlt: string;
  muted: string; border: string; textBody: string;
};

const THEMES: Record<string, Theme> = {
  A: { bg: '#1a1008', accent: '#b83218', light: '#f2ede4', lightAlt: '#ede8e0', muted: 'rgba(242,237,228,0.6)', border: 'rgba(242,237,228,0.25)', textBody: '#5a4030' },
  B: { bg: '#14261a', accent: '#d49b0a', light: '#f5f0e4', lightAlt: '#ece7da', muted: 'rgba(245,240,228,0.6)', border: 'rgba(245,240,228,0.25)', textBody: '#4a5c40' },
  C: { bg: '#0d1e38', accent: '#e05530', light: '#f4f0eb', lightAlt: '#eae6e0', muted: 'rgba(244,240,235,0.6)', border: 'rgba(244,240,235,0.25)', textBody: '#4a5060' },
  D: { bg: '#1e1e1e', accent: '#b5622a', light: '#f7f2ea', lightAlt: '#ede8df', muted: 'rgba(247,242,234,0.6)', border: 'rgba(247,242,234,0.25)', textBody: '#5a4f40' },
};

const sans = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const overline = (C: Theme): React.CSSProperties => ({
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em',
  textTransform: 'uppercase', color: C.accent, marginBottom: '1rem',
});

export default function StreetsCommons() {
  const [C, setC] = useState<Theme>(THEMES.A);

  useEffect(() => {
    fetch('/api/landing-theme')
      .then(r => r.json())
      .then(d => { if (THEMES[d.theme]) setC(THEMES[d.theme]); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ fontFamily: sans, background: C.bg, minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '0 2rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <span style={{ fontWeight: 900, fontSize: '0.8125rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.light }}>
            Streets & Commons Lab
          </span>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: '0.8125rem', color: C.muted, textDecoration: 'none', letterSpacing: '0.05em' }}>
              Contact
            </a>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.light, border: `2px solid ${C.border}`, padding: '0.4375rem 1rem', textDecoration: 'none' }}
            >
              Try SafeStreets →
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── dark bg, diagonal accent slash */}
      <section style={{ background: C.bg, position: 'relative', overflow: 'hidden', minHeight: '520px' }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '45%', height: '100%',
          background: C.accent, clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '5rem 2rem 5rem', maxWidth: '700px' }}>
          <div style={overline(C)}>Est. 2026  -  Urban Research & Action</div>
          <h1 style={{ fontSize: 'clamp(2.75rem, 6vw, 5.5rem)', fontWeight: 900, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.02em', color: C.light, margin: '0 0 2rem' }}>
            The Street<br />Belongs to<br /><span style={{ color: C.accent }}>Everyone.</span>
          </h1>
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: C.muted, maxWidth: '440px', margin: '0 0 2.5rem' }}>
            We work with municipalities, communities, and organisations to build the evidence, tools, and momentum for pedestrian-first streets.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', background: C.accent, color: C.light, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1rem 2rem', textDecoration: 'none' }}
            >
              Try SafeStreets Free →
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Street Audit Request`}
              style={{ display: 'inline-block', border: `2px solid ${C.border}`, color: C.light, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.9375rem 2rem', textDecoration: 'none' }}
            >
              Request an Audit
            </a>
          </div>
        </div>
      </section>

      {/* ── Ticker strip ── */}
      <div style={{ background: C.accent, padding: '0.875rem 2rem', display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto' }}>
        {['Street Audits', 'Walkability Research', 'Community Evidence', 'Open Data Tools', 'Pedestrian-First Streets'].map((item, i) => (
          <span key={item} style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.light, padding: '0 1.5rem' }}>{item}</span>
            {i < 4 && <span style={{ color: `${C.light}55`, fontSize: '0.75rem' }}>·</span>}
          </span>
        ))}
      </div>

      {/* ── How We Work ── light bg */}
      <section style={{ padding: '5.5rem 2rem', background: C.lightAlt }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <div style={overline(C)}>Our Approach</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 900, textTransform: 'uppercase', color: C.bg, letterSpacing: '-0.02em', lineHeight: 1.0 }}>
              Evidence Drives<br />Change.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', borderTop: `3px solid ${C.bg}` }}>
            {[
              { num: '01', title: 'Audit', desc: 'Rigorous, custom street audits using clear scorecards, walkability data, and on-ground documentation.' },
              { num: '02', title: 'Publish', desc: 'Case studies and reports shared openly  -  giving communities and decision-makers the evidence they need.' },
              { num: '03', title: 'Engage', desc: 'Work with residents and governments to push for change that puts the pedestrian first.' },
            ].map(({ num, title, desc }, i) => (
              <div key={num} style={{ padding: '2.5rem 2rem', borderRight: i < 2 ? `1px solid rgba(0,0,0,0.1)` : 'none' }}>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'rgba(0,0,0,0.07)', lineHeight: 1, marginBottom: '0.75rem' }}>{num}</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent, marginBottom: '0.625rem' }}>{title}</div>
                <p style={{ fontSize: '0.9375rem', color: C.textBody, lineHeight: 1.8, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who We Work With ── dark bg */}
      <section style={{ padding: '5.5rem 2rem', background: C.bg }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <div style={overline(C)}>Who We Serve</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 900, textTransform: 'uppercase', color: C.light, letterSpacing: '-0.02em', lineHeight: 1.0 }}>
              Built for<br />Communities.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { label: 'Residents & Communities', desc: 'Street audits and tools that turn daily frustrations into collective action, fostering safer and more connected neighbourhoods.' },
              { label: 'Governments & Municipalities', desc: 'On-the-ground evidence and data that supports safer, more walkable, and scalable street design decisions in urban planning.' },
              { label: 'Corporates & CSR', desc: 'Sponsor small pilot projects that deliver visible, lasting improvements and demonstrate impactful social responsibility.' },
            ].map(({ label, desc }) => (
              <div key={label} style={{ padding: '2rem', borderTop: `3px solid ${C.accent}`, background: 'rgba(255,255,255,0.04)' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.light, margin: '0 0 0.875rem' }}>{label}</h3>
                <p style={{ fontSize: '0.9375rem', color: C.muted, margin: 0, lineHeight: 1.8 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SafeStreets Tool ── light bg */}
      <section style={{ padding: '5.5rem 2rem', background: C.lightAlt }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3rem', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '560px' }}>
            <div style={overline(C)}>Our Free Tool</div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: C.bg, margin: '0 0 1rem', lineHeight: 1.0 }}>
              SafeStreets  - <br />Walkability Analysis<br />for Any Address.
            </h2>
            <p style={{ fontSize: '1rem', color: C.textBody, lineHeight: 1.8, margin: '0 0 2rem' }}>
              Check the walkability score of any neighbourhood in seconds. Built on satellite imagery, OpenStreetMap, EPA, and Census data. No sign-up needed  -  completely free.
            </p>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', background: C.bg, color: C.light, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1rem 2rem', textDecoration: 'none' }}
            >
              Try SafeStreets Free →
            </a>
          </div>
          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '220px' }}>
            {['0-10 Walkability Score', 'PersonaCards  -  car-free, kids, aging', 'CDC Health Outcomes', 'FEMA Flood Risk', '15-Minute City Analysis', 'Satellite Tree Canopy'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: 6, height: 6, background: C.accent, flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: C.textBody, fontWeight: 600 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── dark bg */}
      <section style={{ background: C.bg, padding: '5.5rem 2rem', textAlign: 'center', borderTop: `4px solid ${C.accent}` }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={overline(C)}>Get Involved</div>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 900, textTransform: 'uppercase', color: C.light, letterSpacing: '-0.02em', lineHeight: 1.0, margin: '0 0 1.5rem' }}>
            Ready to Improve<br />Your Streets?
          </h2>
          <p style={{ fontSize: '1rem', color: C.muted, lineHeight: 1.8, margin: '0 0 2.75rem' }}>
            Commission a custom audit for your street, neighbourhood, or project  -  or reach out to explore how we can work together.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Street Audit Request`}
              style={{ display: 'inline-block', background: C.accent, color: C.light, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1rem 2rem', textDecoration: 'none' }}
            >
              Request an Audit →
            </a>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', border: `2px solid ${C.border}`, color: C.light, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.9375rem 2rem', textDecoration: 'none' }}
            >
              Try SafeStreets Free
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── accent bg */}
      <footer style={{ background: C.accent, padding: '2.25rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.8125rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.light }}>Streets & Commons Lab</div>
            <div style={{ fontSize: '0.75rem', color: `${C.light}bb`, marginTop: '0.25rem' }}>Making streets safer, one neighbourhood at a time.</div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: '0.8125rem', color: `${C.light}bb`, textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
            <a href={SAFESTREETS_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: C.light, textDecoration: 'none', fontWeight: 700 }}>SafeStreets →</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
