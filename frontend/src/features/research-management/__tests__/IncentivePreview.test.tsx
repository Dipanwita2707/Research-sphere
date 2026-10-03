/**
 * Incentive & Points Preview on the submission form: the numbers come from the server
 * (POST /research/incentive-preview), requests are debounced, and a failed preview says it is
 * unavailable instead of showing stale numbers.
 */
import React from 'react';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient, renderWithQueryClient } from '@/test-utils/renderWithQueryClient';
import type { IncentivePreview, IncentivePreviewPayload } from '../utils/incentivePreview';
import { incentivePolicyLabel, toIncentivePreviewPayload } from '../utils/incentivePreview';

const mockPreviewIncentive = jest.fn();

jest.mock('@/features/research-management/services/research.service', () => {
  const previewIncentive = (...args: unknown[]) => mockPreviewIncentive(...args);
  const fallback = jest.fn(async () => ({ success: true, data: [] }));
  const researchService = new Proxy({ previewIncentive } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : fallback),
  });
  return { __esModule: true, researchService, default: researchService };
});
jest.mock('@/shared/api/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ data: { success: true, data: null } })),
    post: jest.fn(async () => ({ data: { success: true, data: null } })),
    put: jest.fn(async () => ({ data: { success: true, data: null } })),
  },
}));
jest.mock('@/shared/auth/authStore', () => {
  const user = { id: 'u1', uid: 'DEMO-FAC-01', firstName: 'Demo', lastName: 'Faculty', email: 'demo@uni.test', userType: 'faculty' };
  return { useAuthStore: () => ({ user }) };
});
jest.mock('@/shared/hooks/useAffiliation', () => ({ useAffiliation: () => ({ canonicalName: 'Demo University' }) }));
jest.mock('@/features/research-management/services/duplicateClaim', () => ({
  useDuplicateClaimCheck: () => ({ claims: [] }),
  getDuplicateClaimError: () => null,
}));

// Imported after the mocks.
import ResearchContributionForm from '../components/ResearchContributionForm';
import { useIncentivePreview } from '../hooks/useIncentivePreview';

const PREVIEW: IncentivePreview = {
  publicationType: 'book',
  policy: {
    found: true, usedDefault: false, id: 'bp', name: 'Book Policy 2026',
    distributionMethod: 'equal_split', description: 'split equally among all authors', reason: null,
  },
  pool: { amount: 50000, points: 50 },
  totals: { amount: 12345, points: 7, unallocatedAmount: 0, unallocatedPoints: 0 },
  authors: [{ index: 0, name: 'Demo Faculty', role: 'first_and_corresponding_author', isInternal: true, isStudent: false, position: 1, incentive: 12345, points: 7 }],
  warnings: [],
};

beforeEach(() => {
  mockPreviewIncentive.mockReset();
});

describe('useIncentivePreview', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
  );
  const payload = (n: number): IncentivePreviewPayload => ({ publicationType: 'book', authors: [{ name: `Author ${n}` }] });

  afterEach(() => jest.useRealTimers());

  it('debounces: rapid edits send one request, ~400 ms after the last one', async () => {
    jest.useFakeTimers();
    mockPreviewIncentive.mockResolvedValue(PREVIEW);
    const { result, rerender } = renderHook(({ p }) => useIncentivePreview(p), { wrapper, initialProps: { p: payload(1) } });

    for (let n = 2; n <= 5; n += 1) {
      act(() => { jest.advanceTimersByTime(150); });
      rerender({ p: payload(n) });
    }
    act(() => { jest.advanceTimersByTime(399); });
    expect(mockPreviewIncentive).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    await act(async () => { jest.advanceTimersByTime(1); });
    await waitFor(() => expect(mockPreviewIncentive).toHaveBeenCalledTimes(1));
    expect(mockPreviewIncentive.mock.calls[0][0]).toEqual(payload(5));
    await waitFor(() => expect(result.current.data).toEqual(PREVIEW));
  });

  it('keeps the previous answer on screen (marked as updating) while the next one loads', async () => {
    jest.useFakeTimers();
    mockPreviewIncentive.mockResolvedValueOnce(PREVIEW);
    const { result, rerender } = renderHook(({ p }) => useIncentivePreview(p), { wrapper, initialProps: { p: payload(1) } });
    await act(async () => { jest.advanceTimersByTime(400); });
    await waitFor(() => expect(result.current.data).toEqual(PREVIEW));

    mockPreviewIncentive.mockReturnValueOnce(new Promise(() => {}));
    rerender({ p: payload(2) });
    expect(result.current.data).toEqual(PREVIEW);
    expect(result.current.isUpdating).toBe(true);
  });

  it('error: no data (no stale numbers) and isError', async () => {
    jest.useFakeTimers();
    mockPreviewIncentive.mockResolvedValueOnce(PREVIEW);
    const { result, rerender } = renderHook(({ p }) => useIncentivePreview(p), { wrapper, initialProps: { p: payload(1) } });
    await act(async () => { jest.advanceTimersByTime(400); });
    await waitFor(() => expect(result.current.data).toEqual(PREVIEW));

    mockPreviewIncentive.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    rerender({ p: payload(2) });
    await act(async () => { jest.advanceTimersByTime(400); });
    await act(async () => { jest.advanceTimersByTime(300); }); // one retry for a server error
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockPreviewIncentive).toHaveBeenCalledTimes(3);
    expect(result.current.data).toBeUndefined();
  });

  it('nothing to preview: no request', () => {
    renderHook(() => useIncentivePreview(null), { wrapper });
    expect(mockPreviewIncentive).not.toHaveBeenCalled();
  });
});

describe('incentive preview helpers', () => {
  it('sends only the fields that decide the incentive', () => {
    const payload = toIncentivePreviewPayload({
      publicationType: 'research_paper', title: 'Secret title', publicationDate: '2026-05-01', indexingCategories: ['pubmed'],
      authors: [{ name: 'A', authorRole: 'first_author', email: 'a@x', registrationNumber: 'U1', userId: 'u1', orderNumber: 1 }],
    });
    expect(payload).toEqual({
      publicationType: 'research_paper', publicationDate: '2026-05-01', indexingCategories: ['pubmed'],
      authors: [{ name: 'A', authorRole: 'first_author', registrationNumber: 'U1', orderNumber: 1 }],
    });
  });

  it('labels the policy and its split', () => {
    expect(incentivePolicyLabel({
      ...PREVIEW,
      policy: { ...PREVIEW.policy, name: 'Research Paper Policy 2026', description: 'role-based: first 35% · corresponding 30% · co-authors share 35%' },
    })).toBe('Research Paper Policy 2026 · role-based: first 35% · corresponding 30% · co-authors share 35%');
    expect(incentivePolicyLabel({ ...PREVIEW, policy: { ...PREVIEW.policy, found: false } })).toBeNull();
  });
});

describe('ResearchContributionForm — Incentive & Points Preview', () => {
  it('renders the server numbers, totals and policy', async () => {
    mockPreviewIncentive.mockResolvedValue(PREVIEW);
    renderWithQueryClient(<ResearchContributionForm publicationType="book" />);

    await waitFor(() => expect(screen.getByTestId('preview-total-incentive')).toHaveTextContent('₹12,345'));
    expect(screen.getByTestId('preview-incentive')).toHaveTextContent('₹12,345');
    expect(screen.getByTestId('preview-points')).toHaveTextContent('7');
    expect(screen.getByTestId('preview-total-points')).toHaveTextContent('7');
    expect(screen.getByTestId('incentive-preview-policy')).toHaveTextContent('Book Policy 2026 · split equally among all authors');
    expect(screen.getByTestId('incentive-preview-pool')).toHaveTextContent('Expected Total: ₹50,000 / 50 pts');

    // One request for the settled form, built from the submit payload (applicant as the only author).
    expect(mockPreviewIncentive).toHaveBeenCalledTimes(1);
    const sent = mockPreviewIncentive.mock.calls[0][0];
    expect(sent.publicationType).toBe('book');
    expect(sent.authors).toEqual([expect.objectContaining({ registrationNumber: 'DEMO-FAC-01', authorRole: 'first_and_corresponding_author' })]);
  });

  it('says the preview is unavailable instead of showing numbers when the server fails', async () => {
    mockPreviewIncentive.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    renderWithQueryClient(<ResearchContributionForm publicationType="book" />);

    expect(await screen.findByText(/Incentive preview is unavailable/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('preview-incentive')).toHaveTextContent('—');
    expect(screen.getByTestId('preview-total-incentive')).toHaveTextContent('—');
    expect(screen.queryByText('₹12,345')).not.toBeInTheDocument();
  });
});
