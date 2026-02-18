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
  {
    targetSelector: '#score',
    title: 'Your Walkability Score',
    description: 'See your overall walkability score and letter grade, powered by satellite imagery, OpenStreetMap data, and crash databases.',
  },
  {
    targetSelector: '#metrics',
    title: '8 Walkability Metrics',
    description: 'Every dimension analyzed — from crossing safety and sidewalk coverage to tree canopy and thermal comfort.',
  },
  {
    targetSelector: '#neighborhood',
    title: '15-Minute City Analysis',
    description: 'See what grocery stores, healthcare, transit, and other essentials are within walking distance.',
  },
  {
    targetSelector: '#cross-section',
    title: 'Street Redesign Tool',
    description: 'Visualize your street\'s cross-section and explore improvements like bike lanes, wider sidewalks, and trees.',
  },
  {
    targetSelector: '#tools',
    title: 'Advocacy Toolkit',
    description: 'Generate AI-powered letters to officials, formal proposals, and conduct structured street audits — all from your walkability data.',
  },
  {
    targetSelector: '[aria-label="Open chat"]',
    title: 'Meet Meridian',
    description: 'Your AI urban planning advisor, trained on NACTO and WHO standards. Ask anything about walkability, safety, or street design.',
  },
];

const PADDING = 12;

export default function ProductTour({ isActive, onComplete, onSkip }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const step = STEPS[currentStep];

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    }
  }, [step]);

  // Scroll to target and position spotlight
  useEffect(() => {
    if (!isActive || !step) return;

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wait for scroll to finish, then measure
      const timer = setTimeout(updateSpotlight, 500);
      return () => clearTimeout(timer);
    }
  }, [isActive, currentStep, step, updateSpotlight]);

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

  // Calculate tooltip position (desktop: beside spotlight, mobile: bottom sheet)
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

    const tooltipWidth = 340;
    const margin = 16;
    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;

    // Prefer positioning below the spotlight
    let top = spotlightRect.bottom + PADDING + margin;
    let left = spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2;

    // If below goes off-screen, position above
    if (top + 200 > vpHeight) {
      top = spotlightRect.top - PADDING - margin - 200;
    }

    // Keep within horizontal bounds
    if (left < margin) left = margin;
    if (left + tooltipWidth > vpWidth - margin) left = vpWidth - margin - tooltipWidth;

    return {
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
      animation: 'fadeInUp 0.3s ease-out',
    };
  };

  return (
    <div className="fixed inset-0 z-[60]" onClick={onSkip}>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Spotlight hole */}
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

      {/* Tooltip */}
      <div
        style={getTooltipStyle()}
        className={`bg-white ${isMobile ? 'rounded-t-2xl p-6 pb-8' : 'rounded-xl p-5'} shadow-2xl`}
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
        <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
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
