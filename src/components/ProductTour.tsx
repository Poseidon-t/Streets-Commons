import { useState, useEffect, useCallback, useRef } from 'react';

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
  // --- Free features ---
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
  // --- Premium features ---
  {
    targetSelector: '#cross-section',
    title: 'Street Redesign Tool ✦',
    description: 'See your street\'s cross-section and redesign it — add bike lanes, widen sidewalks, plant trees. Premium feature.',
  },
  {
    targetSelector: '#tools',
    title: 'Advocacy Toolkit ✦',
    description: 'Draft letters to officials, generate formal PDF proposals, and run structured street audits — all data-backed.',
  },
  {
    targetSelector: '[aria-label="Open urbanist advocate"]',
    title: 'Meridian AI Advisor ✦',
    description: 'Your urban planning assistant trained on NACTO & WHO standards. Free tier gets 6 messages — premium unlocks unlimited.',
  },
];

const PADDING = 12;

export default function ProductTour({ isActive, onComplete, onSkip }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = STEPS[currentStep];

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    }
  }, [step]);

  // Scroll to target and position spotlight — skip missing targets
  useEffect(() => {
    if (!isActive || !step) return;

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(updateSpotlight, 500);
      return () => clearTimeout(timer);
    } else {
      // Target not found — skip to next step
      const timer = setTimeout(() => {
        if (currentStep < STEPS.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          onComplete();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, currentStep, step, updateSpotlight, onComplete]);

  // Reposition on resize
  useEffect(() => {
    if (!isActive) return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      updateSpotlight();
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    observerRef.current = new ResizeObserver(updateSpotlight);
    const el = step ? document.querySelector(step.targetSelector) : null;
    if (el) observerRef.current.observe(el);

    return () => {
      window.removeEventListener('resize', handleResize);
      observerRef.current?.disconnect();
    };
  }, [isActive, step, updateSpotlight]);

  // Escape key
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isActive, onSkip]);

  if (!isActive || !spotlightRect) return null;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(0);
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // Tooltip is always pinned to bottom-right (desktop) or bottom sheet (mobile).
  // This avoids all edge cases with tall targets, fixed headers, and viewport clipping.
  const getTooltipStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        animation: 'slideUp 0.3s ease-out',
      };
    }

    return {
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 360,
      animation: 'fadeInUp 0.3s ease-out',
    };
  };

  return (
    <div className="fixed inset-0 z-[60]" onClick={onSkip}>
      {/* Spotlight hole (box-shadow creates the dark overlay — no separate bg needed) */}
      <div
        className="absolute rounded-xl"
        style={{
          top: spotlightRect.top - PADDING,
          left: spotlightRect.left - PADDING,
          width: spotlightRect.width + PADDING * 2,
          height: spotlightRect.height + PADDING * 2,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          animation: 'spotlight-pulse 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip — z-10 ensures it paints above the spotlight box-shadow overlay */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className={`bg-white ${isMobile ? 'rounded-t-2xl p-6 pb-8' : 'rounded-xl p-5'} shadow-2xl relative z-10`}
        onClick={(e) => e.stopPropagation()}
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
          <h3 className="text-lg font-bold text-gray-900">{step.title.replace(' ✦', '')}</h3>
          {step.title.includes('✦') && (
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
    </div>
  );
}
