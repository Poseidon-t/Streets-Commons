import { useState, useEffect, useRef } from 'react';

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
}

interface ProductTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS: TourStep[] = [
  {
    targetSelector: '#score',
    title: 'Your Walkability Score',
    description: 'Overall score and letter grade, powered by satellite imagery, OpenStreetMap, and crash databases.',
  },
  {
    targetSelector: '#metrics',
    title: '8 Walkability Metrics',
    description: 'Crossing safety, sidewalk coverage, tree canopy, thermal comfort, and more — every dimension analyzed.',
  },
  {
    targetSelector: '#neighborhood',
    title: '15-Minute City Analysis',
    description: 'Grocery stores, healthcare, transit, and essentials within walking distance.',
  },
  {
    targetSelector: '#report-actions',
    title: 'Field Verification',
    description: 'Adjust any metric score based on what you actually see on the ground. Add observations, recalculate the overall score, and download a verified PDF report.',
  },
  {
    targetSelector: '#tools',
    title: 'Advocacy Toolkit \u2726',
    description: 'Draft letters to officials, generate formal PDF proposals, and run structured street audits — all data-backed.',
  },
  {
    targetSelector: '[aria-label="Open urbanist advocate"]',
    title: 'Meridian AI Advisor \u2726',
    description: 'Your urban planning assistant trained on NACTO & WHO standards. Free tier gets 12 messages — premium unlocks unlimited.',
  },
];

export default function ProductTour({ isActive, onComplete, onSkip }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = STEPS[currentStep];

  // Scroll to target, skip missing targets
  useEffect(() => {
    if (!isActive || !step) return;

    setIsMobile(window.innerWidth < 640);

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        if (currentStep < STEPS.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          onComplete();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, currentStep, step, onComplete]);

  // Escape key
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isActive, onSkip]);

  if (!isActive || !ready) return null;

  const handleNext = () => {
    setReady(false);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(0);
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setReady(false);
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <>
      {/* Tour card — pinned bottom-right (desktop) or bottom sheet (mobile), no overlay */}
      <div
        ref={tooltipRef}
        className={`fixed z-[60] bg-white border border-gray-200 shadow-lg ${
          isMobile ? 'inset-x-4 bottom-4 rounded-xl p-5' : 'bottom-6 right-6 w-[380px] rounded-xl p-5'
        }`}
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
      >
        {/* Step counter */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-400">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep ? 'bg-terra' : i < currentStep ? 'bg-terra/40' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-bold text-gray-900">{step.title.replace(' \u2726', '')}</h3>
          {step.title.includes('\u2726') && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-terra/10 text-terra uppercase tracking-wide">Premium</span>
          )}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mb-5">{step.description}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition"
          >
            Skip Tour
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-terra text-white text-sm font-semibold rounded-lg hover:bg-terra/90 transition"
            >
              {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
