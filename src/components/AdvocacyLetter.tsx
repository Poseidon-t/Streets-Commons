import { useState, useRef } from 'react';
import type { WalkabilityScoreV2 } from '../types';
import type { Location } from '../types';
import { computePersonas } from '../utils/personas';

interface AdvocacyLetterProps {
  location: Location;
  compositeScore: WalkabilityScoreV2;
  onClose: () => void;
}

function tierLabel(score: number): string {
  if (score >= 80) return 'Walkable';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Car-dependent';
  if (score >= 20) return 'Difficult';
  return 'Hostile';
}

function getWeakestMetrics(cs: WalkabilityScoreV2): { name: string; score: number }[] {
  const all: { name: string; score: number }[] = [];
  for (const comp of Object.values(cs.components)) {
    for (const m of comp.metrics) {
      if (m.score > 0) all.push({ name: m.name, score: m.score });
    }
  }
  return all.sort((a, b) => a.score - b.score).slice(0, 3);
}

function generateLetter(location: Location, cs: WalkabilityScoreV2): string {
  const overall = (cs.overallScore / 10).toFixed(1);
  const tier = tierLabel(cs.overallScore);
  const { networkDesign, environmentalComfort, safety, densityContext } = cs.components;
  const personas = computePersonas(cs);
  const weakest = getWeakestMetrics(cs);
  const address = location.displayName;
  const city = location.city || address.split(',').slice(-2, -1)[0]?.trim() || 'our city';

  const componentLines = [
    { label: 'Network Design', score: networkDesign.score },
    { label: 'Environmental Comfort', score: environmentalComfort.score },
    { label: 'Safety', score: safety.score },
    { label: 'Density Context', score: densityContext.score },
  ];

  const weakComponentLines = componentLines
    .filter(c => c.score < 60)
    .sort((a, b) => a.score - b.score);

  const personaConcerns = personas
    .filter(p => p.score < 45)
    .map(p => `${p.name} (${p.verdictLabel})`);

  let letter = `Dear [Council Member / Local Representative],

I am writing to share data about pedestrian conditions in our neighborhood and to request that the city consider infrastructure improvements in this area.

Using SafeStreets (safestreets.streetsandcommons.com), a free walkability analysis tool powered by satellite imagery and open government data, I analyzed the area around ${address}.

The results show a walkability score of ${overall} out of 10, classified as "${tier}."

The analysis breaks down into four components:
${componentLines.map(c => `  • ${c.label}: ${(c.score / 10).toFixed(1)}/10`).join('\n')}
`;

  if (weakComponentLines.length > 0) {
    letter += `
The weakest areas are ${weakComponentLines.map(c => `${c.label} (${(c.score / 10).toFixed(1)}/10)`).join(' and ')}.`;
  }

  if (weakest.length > 0) {
    letter += `

The specific metrics that scored lowest are:
${weakest.map(m => `  • ${m.name}: ${(m.score / 10).toFixed(1)}/10`).join('\n')}`;
  }

  if (personaConcerns.length > 0) {
    letter += `

This data suggests the area is particularly challenging for: ${personaConcerns.join(', ')}.`;
  }

  letter += `

This analysis is based on open data sources including Sentinel-2 satellite imagery, OpenStreetMap, and${location.countryCode === 'us' ? ' US Census, CDC PLACES, EPA Walkability Index, FEMA flood maps, and' : ''} other publicly available datasets.

I would welcome the opportunity to discuss what improvements  -  such as better crossings, tree planting, traffic calming, or transit access  -  could make this neighborhood safer and more walkable for residents.

You can view the full analysis at: safestreets.streetsandcommons.com

Thank you for your time.

Sincerely,
[Your Name]
[Your Address]`;

  return letter;
}

export default function AdvocacyLetter({ location, compositeScore, onClose }: AdvocacyLetterProps) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const letter = generateLetter(location, compositeScore);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      textRef.current?.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walkability-letter-${location.city || 'neighborhood'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl" style={{ backgroundColor: '#f5f2eb', border: '2px solid #1a1208' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '2px solid #1a1208', background: '#1a3a1a' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e8e0d0' }}>
              Advocacy Letter
            </div>
            <div style={{ fontSize: 11, color: '#a09880', marginTop: 2 }}>
              Pre-filled with your analysis data  -  edit and send to your local representative
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#e8e0d0', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        {/* Letter */}
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            ref={textRef}
            defaultValue={letter}
            className="w-full border rounded-lg p-4 text-sm leading-relaxed resize-none"
            style={{
              minHeight: 400,
              fontFamily: 'DM Sans, sans-serif',
              color: '#1a3a1a',
              backgroundColor: '#ffffff',
              borderColor: '#c4b59a',
            }}
            spellCheck
          />
          <p className="text-xs mt-2" style={{ color: '#8a9a8a' }}>
            Edit the letter above  -  replace [Council Member / Local Representative] and [Your Name] with real details before sending.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid #c4b59a' }}>
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={{ backgroundColor: copied ? '#1a7a28' : '#e07850', color: '#ffffff', border: 'none', cursor: 'pointer' }}
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={{ backgroundColor: '#f5f2eb', color: '#1a3a1a', border: '2px solid #1a1208', cursor: 'pointer' }}
          >
            Download .txt
          </button>
        </div>
      </div>
    </div>
  );
}
