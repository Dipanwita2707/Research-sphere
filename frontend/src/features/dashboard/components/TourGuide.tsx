'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle, Sparkles, CheckCircle } from 'lucide-react';

export interface TourStep {
  id: string;
  target: string; // CSS selector or data-tour-id
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlight?: boolean;
}

interface TourGuideProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function TourGuide({ steps, isOpen, onClose, onComplete }: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [tooltipPlacement, setTooltipPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [highlightRect, setHighlightRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  const currentTourStep = steps[currentStep];

  const calculatePosition = useCallback(() => {
    if (!currentTourStep || !isOpen) return;

    const targetElement = document.querySelector(`[data-tour-id="${currentTourStep.target}"]`) || 
                          document.querySelector(currentTourStep.target);

    if (!targetElement) {
      console.warn(`Tour target not found: ${currentTourStep.target}`);
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 300;
    const padding = 16;
    const arrowSize = 12;

    // Scroll element into view if needed
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    if (rect.top < 0 || rect.bottom > viewportHeight) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Recalculate after scroll
      setTimeout(() => calculatePosition(), 300);
      return;
    }

    // Set highlight rectangle
    setHighlightRect({
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    });

    // Calculate best position for tooltip
    let placement = currentTourStep.position || 'bottom';
    let top = 0;
    let left = 0;

    // Check available space and adjust placement
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    // Auto-adjust if not enough space - prefer top placement for footer elements
    if (placement === 'bottom' && spaceBelow < tooltipHeight + padding) {
      placement = 'top';
    } else if (placement === 'top' && spaceAbove < tooltipHeight + padding) {
      placement = 'bottom';
    } else if (placement === 'left' && spaceLeft < tooltipWidth + padding) {
      placement = spaceRight > spaceLeft ? 'right' : 'top';
    } else if (placement === 'right' && spaceRight < tooltipWidth + padding) {
      placement = spaceLeft > spaceRight ? 'left' : 'top';
    }

    switch (placement) {
      case 'top':
        top = rect.top - tooltipHeight - arrowSize - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + arrowSize + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - arrowSize - padding;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + arrowSize + padding;
        break;
    }

    // Keep tooltip within viewport with more aggressive bounds
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding * 2));

    setTooltipPosition({ top, left });
    setTooltipPlacement(placement);
  }, [currentTourStep, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        calculatePosition();
        setIsAnimating(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isOpen, calculatePosition]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition, true);
      return () => {
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition, true);
      };
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setIsAnimating(true);
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setCurrentStep(0);
    onComplete?.();
    onClose();
    // Save to localStorage that tour is completed
    localStorage.setItem('dashboardTourCompleted', 'true');
  };

  const handleSkip = () => {
    setCurrentStep(0);
    onClose();
  };

  const handleRemindLater = () => {
    setCurrentStep(0);
    onClose();
    // Save timestamp for reminder
    localStorage.setItem('dashboardTourRemindLater', Date.now().toString());
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen || !currentTourStep) return null;

  const getArrowClasses = () => {
    const base = 'absolute w-4 h-4 bg-gray-900 dark:bg-gray-800 transform rotate-45';
    switch (tooltipPlacement) {
      case 'top':
        return `${base} -bottom-2 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${base} -top-2 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${base} -right-2 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${base} -left-2 top-1/2 -translate-y-1/2`;
    }
  };

  return (
    <>
      {/* Overlay with cutout for highlighted element */}
      <div className="fixed inset-0 z-[9998] pointer-events-none">
        {/* Dark overlay - no blur for sharp focus */}
        <div className="absolute inset-0 bg-black/60" style={{ pointerEvents: 'auto' }} onClick={handleSkip} />
        
        {/* Spotlight cutout - completely transparent for crystal clear visibility */}
        <div
          className="absolute transition-all duration-300 ease-out pointer-events-auto"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '12px',
            border: '4px solid #3b82f6',
            backgroundColor: 'transparent',
            zIndex: 9999,
          }}
        >
          {/* Glow ring - no animation for cleaner look */}
          <div className="absolute inset-0 rounded-xl border-3 border-blue-400" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' }} />
        </div>
      </div>

      {/* Tooltip - Always on top */}
      <div
        className="fixed z-[99999] w-[400px] opacity-100 scale-100"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          maxHeight: 'calc(100vh - 40px)',
          pointerEvents: 'auto',
        }}
      >
        {/* Arrow */}
        <div className={getArrowClasses()} style={{ zIndex: 100000 }} />
        
        {/* Tooltip Content */}
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-2 border-blue-500 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span className="text-white font-bold text-lg">{currentTourStep.title}</span>
              </div>
              <button
                onClick={handleSkip}
                className="text-white/70 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full"
                aria-label="Close tour"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-5 bg-white dark:bg-gray-900">
            <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
              {currentTourStep.description}
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 bg-white dark:bg-gray-900">
            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Step {currentStep + 1} of {steps.length}
              </span>
              <div className="flex gap-1.5">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentStep
                        ? 'bg-blue-600 w-8'
                        : idx < currentStep
                          ? 'bg-blue-400 w-2'
                          : 'bg-gray-300 dark:bg-gray-600 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-md ${
                  currentStep === 0
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-lg'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
              
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <span>Finish Tour</span>
                    <CheckCircle className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Skip/Remind later */}
            <div className="flex justify-center mt-4">
              <button
                onClick={handleRemindLater}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors underline underline-offset-2"
              >
                I&apos;ll look back later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Tour Start Button Component
export function TourStartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
      aria-label="Start virtual tour"
    >
      <HelpCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      <span className="font-semibold text-sm">Take a Tour</span>
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />
    </button>
  );
}

// Profile Picture Tour Trigger (for the specific "Tap your photo" tooltip)
export function ProfileTourTrigger({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 max-w-xs animate-in zoom-in-95 duration-200"
        style={{ top: '120px', right: '20px' }}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-bold text-gray-900 dark:text-white">Profile pic</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Tap your photo to access quick options like changing your UMS password, resetting Wi-Fi password, updating your profile, or signing out.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">1 of 17</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Back
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
        <button className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline">
          I&apos;ll look back later
        </button>
      </div>
    </div>
  );
}
