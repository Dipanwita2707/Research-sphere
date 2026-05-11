'use client';

import { useEffect } from 'react';

interface PerformanceMonitorProps {
  pageName: string;
}

export default function PerformanceMonitor({ pageName }: PerformanceMonitorProps) {
  useEffect(() => {
    // Only run in development or when performance monitoring is enabled
    if (process.env.NODE_ENV !== 'development' && !process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log(`[${pageName}] LCP: ${entry.startTime.toFixed(2)}ms`);
        }
        
        if (entry.entryType === 'first-input') {
          const eventTiming = entry as PerformanceEventTiming;
          console.log(`[${pageName}] FID: ${eventTiming.processingStart - entry.startTime}ms`);
        }
        
        if (entry.entryType === 'layout-shift') {
          console.log(`[${pageName}] CLS: ${(entry as any).value}`);
        }
      });
    });

    // Observe Core Web Vitals
    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });

    // Measure page load time
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const loadTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
      console.log(`[${pageName}] Page Load Time: ${loadTime.toFixed(2)}ms`);
    }

    return () => {
      observer.disconnect();
    };
  }, [pageName]);

  return null;
}