/**
 * Streets & Commons Lab — landing page
 * Served at streetsandcommons.com
 * Mission/story layer; funnels to SafeStreets product.
 */

const SAFESTREETS_URL = 'https://safestreets.streetsandcommons.com';
const CONTACT_EMAIL = 'hello@streetsandcommons.com';

const C = {
  forest: '#1e3020',
  forestLight: '#2d4a32',
  brick: '#b84a2a',
  brickLight: '#cc5a38',
  text: '#241c14',
  muted: '#6b5c47',
  light: '#9e8f7f',
  border: '#d9cfc0',
  bg: '#faf7f2',
  bgAlt: '#f2ece0',
  bgDark: '#1e3020',
  cream: '#fdf9f4',
};

const serif = '"Georgia", "Times New Roman", serif';
const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function StreetsCommons() {
  return (
    <div style={{ fontFamily: sans, color: C.text, background: C.bg, minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(250,247,242,0.97)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <span style={{ fontFamily: serif, fontWeight: 700, fontSize: '1.0625rem', color: C.forest, letterSpacing: '0.01em' }}>
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
              style={{ fontSize: '0.875rem', fontWeight: 600, color: C.cream, background: C.brick, padding: '0.5rem 1rem', borderRadius: '4px', textDecoration: 'none' }}
            >
              Try SafeStreets →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 4.5rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ width: '2rem', height: '1px', background: C.brick }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.brick }}>
            Streets & Commons Lab
          </span>
          <div style={{ width: '2rem', height: '1px', background: C.brick }} />
        </div>
        <h1 style={{ fontFamily: serif, fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 700, lineHeight: 1.2, color: C.forest, margin: '0 0 1.5rem' }}>
          Making Streets Safer<br />and More Walkable
        </h1>
        <p style={{ fontSize: '1.125rem', color: C.muted, lineHeight: 1.8, margin: '0 0 2.75rem', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          We work with municipalities, communities, and organisations to build the evidence, tools, and momentum for pedestrian-first streets.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={SAFESTREETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: C.brick, color: C.cream, fontWeight: 600, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '4px', textDecoration: 'none' }}
          >
            Try SafeStreets Free →
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Street Audit Request`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', color: C.forest, fontWeight: 600, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '4px', textDecoration: 'none', border: `1.5px solid ${C.border}` }}
          >
            Request an Audit
          </a>
        </div>
      </section>

      {/* Divider */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ borderTop: `1px solid ${C.border}` }} />
      </div>

      {/* SafeStreets callout banner */}
      <section style={{ background: C.bgDark, padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.brick, marginBottom: '0.625rem' }}>Our Tool</div>
            <h2 style={{ fontFamily: serif, fontSize: '1.5rem', fontWeight: 700, color: C.cream, margin: '0 0 0.5rem', lineHeight: 1.3 }}>
              SafeStreets — Free Walkability Analysis
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'rgba(253,249,244,0.6)', margin: 0, lineHeight: 1.7, maxWidth: '480px' }}>
              Check the walkability of any neighbourhood in seconds. Built on satellite data, OSM, EPA, and Census — no sign-up needed.
            </p>
          </div>
          <a
            href={SAFESTREETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: C.brick, color: C.cream, fontWeight: 600, fontSize: '0.9375rem', padding: '0.75rem 1.5rem', borderRadius: '4px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Try it free →
          </a>
        </div>
      </section>

      {/* How we work */}
      <section style={{ padding: '5.5rem 1.5rem', background: C.bg }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ maxWidth: '560px', marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '1.5rem', height: '1px', background: C.brick }} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.brick }}>Our Approach</span>
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(1.5rem, 3vw, 2.125rem)', fontWeight: 700, color: C.forest, margin: '0 0 0.75rem' }}>How We Work</h2>
            <p style={{ fontSize: '1rem', color: C.muted, margin: 0, lineHeight: 1.8 }}>
              Each step builds evidence, visibility, and momentum for safer streets.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0' }}>
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
            ].map(({ step, title, desc }, i) => (
              <div key={step} style={{ padding: '2rem 2rem 2rem', borderLeft: i === 0 ? `3px solid ${C.brick}` : `1px solid ${C.border}`, background: i % 2 === 0 ? C.bgAlt : C.bg }}>
                <div style={{ fontFamily: serif, fontSize: '2rem', fontWeight: 700, color: C.border, marginBottom: '1rem', lineHeight: 1 }}>{step}</div>
                <h3 style={{ fontFamily: serif, fontSize: '1.1875rem', fontWeight: 700, color: C.forest, margin: '0 0 0.625rem' }}>{title}</h3>
                <p style={{ fontSize: '0.9375rem', color: C.muted, margin: 0, lineHeight: 1.75 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ borderTop: `1px solid ${C.border}` }} />
      </div>

      {/* Who we work with */}
      <section style={{ padding: '5.5rem 1.5rem', background: C.bg }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ maxWidth: '560px', marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '1.5rem', height: '1px', background: C.brick }} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.brick }}>Partners</span>
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(1.5rem, 3vw, 2.125rem)', fontWeight: 700, color: C.forest, margin: '0 0 0.75rem' }}>Who We Work With</h2>
            <p style={{ fontSize: '1rem', color: C.muted, margin: 0, lineHeight: 1.8 }}>
              We bring together communities, institutions, and governments around a shared goal.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              {
                label: 'Residents & Communities',
                desc: 'Street audits and tools that turn daily frustrations into collective action, fostering safer and more connected neighbourhoods.',
              },
              {
                label: 'Governments & Municipalities',
                desc: 'On-the-ground evidence and data that supports safer, more walkable, and scalable street design decisions in urban planning.',
              },
              {
                label: 'Corporates & CSR',
                desc: 'Sponsor small pilot projects that deliver visible, lasting improvements and demonstrate impactful social responsibility.',
              },
            ].map(({ label, desc }) => (
              <div key={label} style={{ padding: '2rem', borderTop: `3px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, borderRadius: '2px', background: C.cream }}>
                <h3 style={{ fontFamily: serif, fontSize: '1.0625rem', fontWeight: 700, color: C.forest, margin: '0 0 0.75rem' }}>{label}</h3>
                <p style={{ fontSize: '0.9375rem', color: C.muted, margin: 0, lineHeight: 1.75 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get involved / CTA */}
      <section style={{ padding: '5.5rem 1.5rem', background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '2rem', height: '1px', background: C.brick }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.brick }}>Get Involved</span>
            <div style={{ width: '2rem', height: '1px', background: C.brick }} />
          </div>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 700, color: C.forest, margin: '0 0 1.25rem' }}>
            Ready to Improve Your Streets?
          </h2>
          <p style={{ fontSize: '1.0625rem', color: C.muted, lineHeight: 1.8, margin: '0 0 2.75rem' }}>
            Commission a custom audit for your street, neighbourhood, or project — or reach out to explore how we can work together.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Street Audit Request`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: C.brick, color: C.cream, fontWeight: 600, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '4px', textDecoration: 'none' }}
            >
              Request an Audit
            </a>
            <a
              href={SAFESTREETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', color: C.forest, fontWeight: 600, fontSize: '1rem', padding: '0.875rem 1.75rem', borderRadius: '4px', textDecoration: 'none', border: `1.5px solid ${C.border}` }}
            >
              Try SafeStreets Free →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: C.forest, padding: '2.5rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: serif, fontWeight: 700, color: C.cream, fontSize: '1rem', marginBottom: '0.25rem' }}>Streets & Commons Lab</div>
            <div style={{ fontSize: '0.8125rem', color: 'rgba(253,249,244,0.45)' }}>Making streets safer, one neighbourhood at a time.</div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: '0.8125rem', color: 'rgba(253,249,244,0.55)', textDecoration: 'none' }}>
              {CONTACT_EMAIL}
            </a>
            <a href={SAFESTREETS_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: C.brick, textDecoration: 'none', fontWeight: 600 }}>
              SafeStreets →
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
