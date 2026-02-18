/**
 * Advocacy Letter Modal
 * AI-generated formal letter to city officials based on walkability metrics
 */

import { useState, useEffect } from 'react';
import type { Location, WalkabilityMetrics, WalkabilityScoreV2, CrashData, DemographicData } from '../types';
import { COLORS } from '../constants';

interface AdvocacyLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
  metrics: WalkabilityMetrics;
  compositeScore?: WalkabilityScoreV2 | null;
  crashData?: CrashData | null;
  demographicData?: DemographicData | null;
}

export default function AdvocacyLetterModal({
  isOpen,
  onClose,
  location,
  metrics,
  compositeScore,
  crashData,
  demographicData,
}: AdvocacyLetterModalProps) {
  const [letter, setLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [language, setLanguage] = useState('en');

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { setStep('form'); setLetter(''); setError(null); onClose(); } };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/generate-advocacy-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: {
            displayName: location.displayName,
            lat: location.lat,
            lon: location.lon,
          },
          metrics,
          compositeScore: compositeScore ? {
            overallScore: compositeScore.overallScore,
            grade: compositeScore.grade,
            components: Object.fromEntries(
              Object.entries(compositeScore.components).map(([k, v]) => [k, { label: v.label, score: v.score }])
            ),
          } : undefined,
          crashData: crashData ? (crashData.type === 'local'
            ? { type: 'local', totalCrashes: crashData.totalCrashes, totalFatalities: crashData.totalFatalities, yearRange: crashData.yearRange }
            : { type: 'country', deathRatePer100k: crashData.deathRatePer100k, countryName: crashData.countryName, totalDeaths: crashData.totalDeaths }
          ) : undefined,
          demographicData: demographicData || undefined,
          authorName: authorName.trim() || undefined,
          recipientTitle: recipientTitle.trim() || undefined,
          language: language !== 'en' ? language : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setLetter(data.letter);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Failed to generate letter');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advocacy-letter-${location.displayName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setStep('form');
    setLetter('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            {step === 'form' ? 'Draft Letter to Officials' : 'Your Advocacy Letter'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'form' ? (
            <div className="space-y-5">
              {/* Location summary */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="font-semibold text-gray-800">{location.displayName}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Walkability Score: <strong>{metrics.overallScore.toFixed(1)}/10</strong> ({metrics.label})
                </div>
              </div>

              <p className="text-gray-600 text-sm">
                Generate a professional letter citing your walkability data to send to city council,
                municipal officials, or local representatives. The letter will reference specific
                metrics and international standards.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name / Organization (optional)
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g., Jane Smith, Walkable Streets Coalition"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-terra/40 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient (optional)
                </label>
                <input
                  type="text"
                  value={recipientTitle}
                  onChange={(e) => setRecipientTitle(e.target.value)}
                  placeholder="e.g., City Council, Mayor's Office, Department of Transportation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-terra/40 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Letter Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-terra/40 focus:border-transparent bg-white"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="hi">हिन्दी</option>
                  <option value="zh">中文</option>
                  <option value="ar">العربية</option>
                  <option value="pt">Português</option>
                  <option value="th">ไทย</option>
                </select>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Editable letter */}
              <textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                className="w-full h-48 sm:h-64 md:h-[400px] p-4 border border-gray-300 rounded-xl text-sm leading-relaxed font-serif resize-none focus:ring-2 focus:ring-terra/40 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                You can edit the letter above before copying or downloading.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          {step === 'form' ? (
            <>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-2.5 text-white font-semibold rounded-xl transition-all hover:shadow-lg disabled:opacity-60"
                style={{ backgroundColor: COLORS.primary }}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Drafting...
                  </span>
                ) : (
                  'Generate Letter'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('form'); setLetter(''); }}
                className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-lg"
              >
                Regenerate
              </button>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Download .txt
              </button>
              <button
                onClick={handleCopy}
                className="px-6 py-2.5 text-white font-semibold rounded-xl transition-all hover:shadow-lg"
                style={{ backgroundColor: copied ? '#16a34a' : COLORS.primary }}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
