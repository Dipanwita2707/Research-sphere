import React from 'react';
import { BRAND } from '@/shared/config/brand';

interface WordmarkProps {
  className?: string;
  /** Tailwind text size class for the wordmark, e.g. "text-lg" */
  sizeClassName?: string;
  /** Override computed height, e.g. "h-14 sm:h-16" */
  heightClassName?: string;
  /** Render "Sphere" in amber (default) or ivory for dark surfaces */
  sphereColor?: 'amber' | 'ivory' | 'wine';
  /** Render "Research" in charcoal (default) or ivory for dark surfaces */
  researchColor?: 'charcoal' | 'ivory' | 'white';
}

const sphereColorMap = {
  amber: 'text-amber-500',
  ivory: 'text-ivory',
  wine: 'text-brand-600',
};

const researchColorMap = {
  charcoal: 'text-charcoal',
  ivory: 'text-ivory',
  white: 'text-white',
};

export function Wordmark({
  className = '',
  sizeClassName = 'text-base',
  heightClassName,
}: WordmarkProps) {
  let heightClass = 'h-9';
  if (!heightClassName) {
    if (sizeClassName.includes('text-3xl')) {
      heightClass = 'h-16 sm:h-20';
    } else if (sizeClassName.includes('text-2xl')) {
      heightClass = 'h-12 sm:h-14';
    } else if (sizeClassName.includes('text-xl')) {
      heightClass = 'h-11 sm:h-12';
    } else if (sizeClassName.includes('text-lg')) {
      heightClass = 'h-10 sm:h-12';
    } else if (sizeClassName.includes('text-base')) {
      heightClass = 'h-9 sm:h-11';
    }
  } else {
    heightClass = heightClassName;
  }

  return (
    <img
      src="/logo.png"
      alt={BRAND.name}
      width={929}
      height={310}
      decoding="async"
      className={`${heightClass} w-auto max-w-none object-contain object-left ${className}`}
    />
  );
}

export default Wordmark;
