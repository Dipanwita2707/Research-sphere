// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// jsdom does not implement the layout-based observer APIs or matchMedia. These mocks are installed
// only when the environment lacks them, and model a page where every element is on screen.
if (typeof window !== 'undefined') {
  if (typeof window.IntersectionObserver === 'undefined') {
    class MockIntersectionObserver {
      constructor(callback, options = {}) {
        this.callback = callback
        this.root = options.root ?? null
        this.rootMargin = options.rootMargin ?? '0px'
        this.thresholds = Array.isArray(options.threshold)
          ? options.threshold
          : [options.threshold ?? 0]
        this.elements = new Set()
      }

      observe(target) {
        if (this.elements.has(target)) return
        this.elements.add(target)
        // jsdom has no layout, so treat every observed element as fully in view.
        const rect = target.getBoundingClientRect()
        this.callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: rect,
              intersectionRect: rect,
              rootBounds: null,
              time: Date.now(),
            },
          ],
          this
        )
      }

      unobserve(target) {
        this.elements.delete(target)
      }

      disconnect() {
        this.elements.clear()
      }

      takeRecords() {
        return []
      }
    }
    window.IntersectionObserver = MockIntersectionObserver
    global.IntersectionObserver = MockIntersectionObserver
  }

  if (typeof window.ResizeObserver === 'undefined') {
    class MockResizeObserver {
      constructor(callback) {
        this.callback = callback
      }

      observe() {}

      unobserve() {}

      disconnect() {}
    }
    window.ResizeObserver = MockResizeObserver
    global.ResizeObserver = MockResizeObserver
  }

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
}
