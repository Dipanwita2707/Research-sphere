import React from 'react';
import { act, render, screen, renderHook } from '@testing-library/react';
import DuplicateClaimWarning from '../DuplicateClaimWarning';
import {
  duplicateClaimMessage,
  getDuplicateClaimError,
  useDuplicateClaimCheck,
} from '@/features/research-management/services/duplicateClaim';

const mockGet = jest.fn();
jest.mock('@/shared/api/api', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));
jest.mock('@/shared/utils/logger', () => ({ logger: { debug: jest.fn(), error: jest.fn() } }));
jest.mock('lucide-react', () => ({ AlertTriangle: () => <svg data-testid="alert-icon" /> }));

const claim = { applicationNumber: 'RP-2026-0007', status: 'under_review', claimedBy: 'Dr. Asha Rao', title: 'Paper' };

describe('DuplicateClaimWarning', () => {
  it('renders nothing when there is no claim', () => {
    const { container } = render(<DuplicateClaimWarning claims={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the claimant, application number and status', () => {
    render(<DuplicateClaimWarning claims={[claim]} />);
    const card = screen.getByTestId('duplicate-claim-warning');
    expect(card).toHaveTextContent(
      'Already claimed by Dr. Asha Rao (RP-2026-0007, under review). Ask them to add you as a co-author instead of submitting again.',
    );
    expect(card).toHaveAttribute('role', 'alert');
  });

  it('shows the submit-time message when there is no live claim', () => {
    render(<DuplicateClaimWarning claims={[]} message="Already claimed by X (A-1, submitted). Ask them to add you as a co-author instead of submitting again." />);
    expect(screen.getByTestId('duplicate-claim-warning')).toHaveTextContent('Already claimed by X (A-1, submitted).');
  });
});

describe('getDuplicateClaimError', () => {
  it('recognises the 409 DUPLICATE_CLAIM response', () => {
    const err = { response: { status: 409, data: { code: 'DUPLICATE_CLAIM', message: 'server text', existing: claim } } };
    expect(getDuplicateClaimError(err)?.message).toBe(duplicateClaimMessage(claim));
  });

  it('falls back to the server message without claim details', () => {
    const err = { response: { status: 409, data: { code: 'DUPLICATE_CLAIM', message: 'This work has already been claimed.' } } };
    expect(getDuplicateClaimError(err)?.message).toBe('This work has already been claimed.');
  });

  it('ignores other errors', () => {
    expect(getDuplicateClaimError({ response: { status: 400, data: { message: 'bad' } } })).toBeNull();
    expect(getDuplicateClaimError(new Error('x'))).toBeNull();
  });
});

describe('useDuplicateClaimCheck', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGet.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('debounces for 600ms and returns the claims', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { workKey: 'doi:10.1/x', duplicate: true, claims: [claim] } } });
    const { result } = renderHook(() => useDuplicateClaimCheck({ publicationType: 'research_paper', doi: '10.1000/xyz123' }));

    await act(async () => { jest.advanceTimersByTime(599); });
    expect(mockGet).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockGet).toHaveBeenCalledWith('/research/duplicates/check', {
      params: { publicationType: 'research_paper', doi: '10.1000/xyz123' },
    });
    expect(result.current.claims).toEqual([claim]);
  });

  it('does not call the server without identifying data', async () => {
    renderHook(() => useDuplicateClaimCheck({ publicationType: 'research_paper', title: 'short' }));
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(mockGet).not.toHaveBeenCalled();
  });
});
