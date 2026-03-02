/**
 * Razorpay Checkout Script Loader
 *
 * Dynamically loads the Razorpay Checkout.js script and ensures
 * it's only loaded once, even with concurrent calls.
 */

let razorpayPromise: Promise<boolean> | null = null;

/**
 * Load the Razorpay Checkout script. Returns true if loaded successfully.
 * Idempotent — safe to call multiple times.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  // Already loaded
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve(true);
  }

  // Loading in progress
  if (razorpayPromise) return razorpayPromise;

  razorpayPromise = new Promise<boolean>((resolve) => {
    // Check if script tag already exists
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayPromise = null; // Allow retry
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayPromise;
};

/**
 * Check if Razorpay Checkout is available.
 */
export const isRazorpayLoaded = (): boolean => {
  return typeof window !== 'undefined' && !!window.Razorpay;
};
