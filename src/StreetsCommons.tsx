/**
 * Streets & Commons Lab — landing page
 * Served at streetsandcommons.com
 * Mission/story layer; funnels to SafeStreets product.
 */

const SAFESTREETS_URL = 'https://safestreets.streetsandcommons.com';
const CONTACT_EMAIL = 'hello@streetsandcommons.com';

const C = {
  navy: '#0f1f3d',
  navyLight: '#1e3a5f',
  orange: '#e04f00',
  orangeLight: '#f5601a',
  text: '#1a1a2e',
  muted: '#5a6070',
  light: '#9aa0ad',
  border: '#e8e8ec',
  bg: '#ffffff',
  bgAlt: '#f8f8fb',
};

export default function StreetsCommons() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: C.text, background: C.bg, minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: C.navy, letterSpacing: '-0.01em' }}>
            Streets & Commons Lab
          </span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: '0.875rem', color: C.muted, textDecoration: 'none' }}>
              Contact
            </a>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.875rem', fontWeight: 600, color: C.bg, background: C.orange, padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none' }}
            >
              Try SafeStreets →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.orange, background: 'rgba(224,79,0,0.08)', padding: '0.375rem 0.875rem', borderRadius: '9999px', marginBottom: '1.5rem' }}>
          Streets & Commons Lab
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: C.navy, margin: '0 0 1.25rem' }}>
          We help cities become safer,<br />more walkable places.
        </h1>
        <p style={{ fontSize: '1.125rem', color: C.muted, lineHeight: 1.7, margin: '0 0 2.5rem', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          We work with municipalities, communities, and organisations to build the evidence, tools, and momentum for pedestrian-first streets.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={SAFESTREETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: C.orange, color: '#fff', fontWeight: 700, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '8px', textDecoration: 'none' }}
          >
            Try SafeStreets Free →
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Street Audit Request`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', color: C.navy, fontWeight: 600, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '8px', textDecoration: 'none', border: `2px solid ${C.border}` }}
          >
            Request an Audit
          </a>
        </div>
      </section>

      {/* SafeStreets callout banner */}
      <section style={{ background: C.navy, padding: '2.5rem 1.5rem', margin: '0 0 0' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.orange, marginBottom: '0.5rem' }}>Our Tool</div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>
              SafeStreets — Free Walkability Analysis
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.5rem', marginBottom: 0, lineHeight: 1.6 }}>
              Check the walkability of any neighborhood in seconds. Built on satellite data, OSM, EPA, and Census — no sign-up needed.
            </p>
          </div>
          <a
            href={SAFESTREETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: C.orange, color: '#fff', fontWeight: 700, fontSize: '0.9375rem', padding: '0.75rem 1.5rem', borderRadius: '8px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Try it free →
          </a>
        </div>
      </section>

      {/* How we work */}
      <section style={{ padding: '5rem 1.5rem', background: C.bgAlt }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ maxWidth: '560px', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: C.navy, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>How We Work</h2>
            <p style={{ fontSize: '1rem', color: C.muted, margin: 0, lineHeight: 1.7 }}>
              Each step builds evidence, visibility, and momentum for safer streets.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {[
              {
                step: '01',
                title: 'Audit',
                desc: 'Rigorous, custom street audits using clear scorecards, walkability data, and on-ground documentation.',
              },
              {
                step: '02',
                title: 'Publish',
                desc: 'Case studies and reports shared openly — giving communities and decision-makers the evidence they need.',
              },
              {
                step: '03',
                title: 'Engage',
                desc: 'Work with residents and governments to legitimise findings and push for change that puts the pedestrian first.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ background: '#fff', padding: '1.75rem', borderRadius: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: C.orange, marginBottom: '0.75rem' }}>{step}</div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: C.navy, margin: '0 0 0.625rem' }}>{title}</h3>
                <p style={{ fontSize: '0.9375rem', color: C.muted, margin: 0, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we work with */}
      <section style={{ padding: '5rem 1.5rem', background: C.bg }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ maxWidth: '560px', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: C.navy, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>Who We Work With</h2>
            <p style={{ fontSize: '1rem', color: C.muted, margin: 0, lineHeight: 1.7 }}>
              We bring together communities, institutions, and governments around a shared goal.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {[
              {
                icon: '🏘️',
                title: 'Residents & Communities',
                desc: 'Street audits and tools that turn daily frustrations into collective action, fostering safer and more connected neighbourhoods.',
              },
              {
                icon: '🏛️',
                title: 'Governments & Municipalities',
                desc: 'On-the-ground evidence and data that supports safer, more walkable, and scalable street design decisions in urban planning.',
              },
              {
                icon: '🤝',
                title: 'Corporates & CSR',
                desc: 'Sponsor small pilot projects that deliver visible, lasting improvements and demonstrate impactful social responsibility.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: '1.75rem', borderRadius: '12px', border: `2px solid ${C.border}` }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>{icon}</div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: C.navy, margin: '0 0 0.625rem' }}>{title}</h3>
                <p style={{ fontSize: '0.9375rem', color: C.muted, margin: 0, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get involved / CTA */}
      <section style={{ padding: '5rem 1.5rem', background: C.bgAlt }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, color: C.navy, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
            Get Involved
          </h2>
          <p style={{ fontSize: '1.0625rem', color: C.muted, lineHeight: 1.7, margin: '0 0 2.5rem' }}>
            Commission a custom audit for your street, neighbourhood, or project — or reach out to explore how we can work together.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Street Audit Request`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: C.orange, color: '#fff', fontWeight: 700, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '8px', textDecoration: 'none' }}
            >
              Request an Audit
            </a>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', color: C.navy, fontWeight: 600, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '8px', textDecoration: 'none', border: `2px solid ${C.border}` }}
            >
              Try SafeStreets Free →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: C.navy, padding: '2.5rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>Streets & Commons Lab</div>
            <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)' }}>Making streets safer, one neighbourhood at a time.</div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {CONTACT_EMAIL}
            </a>
            <a href={SAFESTREETS_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: C.orange, textDecoration: 'none', fontWeight: 600 }}>
              SafeStreets →
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
