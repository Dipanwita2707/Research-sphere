import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A QueryClient for tests: no retries (failures surface immediately) and no garbage collection
 * of cached queries while a test is still running.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/**
 * Render a component that uses React Query hooks. Each call gets a fresh QueryClient unless one is
 * passed in, so cached data never leaks between tests.
 */
export function renderWithQueryClient(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient(), ...options }: RenderOptions & { queryClient?: QueryClient } = {}
): RenderResult & { queryClient: QueryClient } {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}
