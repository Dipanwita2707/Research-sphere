import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PayoutQueueView from '../views/PayoutQueueView';
import { financeService } from '../services/finance.service';
import type { PayoutLine, PayoutListParams } from '../types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/finance/payouts',
}));
jest.mock('@/shared/ui-components/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock('../hooks/useFinancePermissions', () => ({
  useFinancePermissions: () => ({ canView: true, canReview: true, canApprove: false, canRecordPayment: true, isLoading: false }),
}));
jest.mock('../services/finance.service', () => ({
  financeService: { listPayouts: jest.fn(), recommend: jest.fn(), getPayout: jest.fn() },
}));

const listPayouts = financeService.listPayouts as jest.MockedFunction<typeof financeService.listPayouts>;
const recommend = financeService.recommend as jest.MockedFunction<typeof financeService.recommend>;

const line = (id: string, amount: number, extra: Partial<PayoutLine> = {}): PayoutLine => ({
  id, sourceType: 'research_contribution', sourceId: `c-${id}`, researchContributionId: `c-${id}`, workType: 'research_paper',
  title: `Paper ${id}`, referenceNumber: `RC-${id}`, payeeName: `Author ${id}`, payeeEmployeeId: `E${id}`, payeeRole: 'first_author',
  calculatedAmount: amount, approvedAmount: amount, points: 4, adjustmentReason: null, status: 'pending_verification', holdReason: null,
  financialYear: '2026-27', sourceApprovedAt: null, recommendedById: null, recommendedAt: null, batchId: null, batch: null,
  tdsAmount: null, netAmount: amount, paymentReference: null, paidAt: null, ...extra,
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><PayoutQueueView /></QueryClientProvider>);
}

describe('PayoutQueueView', () => {
  beforeEach(() => {
    listPayouts.mockImplementation(async (p: PayoutListParams = {}) => ({
      items: [line('1', 10000), line('2', 2500.5)], total: 2, page: 1, limit: 25, totalAmount: 12500.5,
      // tab badges come back with the page (one request, not one per status)
      ...(p.withStatusCounts ? { statusCounts: { pending_verification: { count: 2, amount: 12500.5 } } } : {}),
    }));
    recommend.mockResolvedValue({ recommended: 2 });
  });

  it('asks for the tab counts in the same request as the page', async () => {
    renderView();
    await screen.findByText('Paper 1');
    expect(listPayouts.mock.calls.every(([p]) => p?.withStatusCounts === true)).toBe(true);
    expect(listPayouts.mock.calls.some(([p]) => p?.limit === 1)).toBe(false);
  });

  it('lists lines, totals a selection and recommends it', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Paper 1')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Awaiting verification/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(within(screen.getByRole('tab', { name: /Awaiting verification/ })).getByText('2')).toBeInTheDocument());
    expect(screen.getByText('₹12,500.50')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Select all actionable lines on this page'));
    expect(screen.getByText('2', { selector: 'span.font-semibold' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Recommend 2/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Recommend for payment' });
    expect(within(dialog).getByText('₹12,500.50')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Recommend 2 lines' }));
    await waitFor(() => expect(recommend).toHaveBeenCalledWith(['1', '2'], undefined));
  });

  it('shows an error with retry when the list fails', async () => {
    listPayouts.mockRejectedValue({ isAxiosError: true, response: { status: 500, data: { success: false, message: 'Finance request failed' } } });
    renderView();
    // 5xx is retried once before the error shows
    expect(await screen.findByText("Couldn't load payout lines", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });
});
