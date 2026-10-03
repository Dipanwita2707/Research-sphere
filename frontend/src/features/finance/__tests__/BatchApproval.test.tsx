import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BatchActions from '../components/BatchActions';
import { ApproveBatchDialog, approvalBlockReason, approvalConflict } from '../components/BatchDialogs';
import type { PayoutLine } from '../types';

const line = (overrides: Partial<PayoutLine> = {}): PayoutLine => ({
  id: 'l1', sourceType: 'research_contribution', sourceId: 'c1', researchContributionId: 'c1', workType: 'research_paper',
  title: 'Paper', referenceNumber: 'RC-1', payeeName: 'Dr. A', payeeEmployeeId: 'E1', payeeRole: 'first_author',
  calculatedAmount: 1000, approvedAmount: 1000, points: 5, adjustmentReason: null, status: 'recommended', holdReason: null,
  financialYear: '2026-27', sourceApprovedAt: null, recommendedById: 'reviewer', recommendedAt: null, batchId: 'b1',
  tdsAmount: null, netAmount: 1000, paymentReference: null, paidAt: null, ...overrides,
});

const props = {
  canApprove: true, canReview: true, canRecordPayment: true,
  onApprove: jest.fn(), onPay: jest.fn(), onCancel: jest.fn(), onExport: jest.fn(),
};

describe('separation of duties on batch approval', () => {
  it('disables Approve with an explanation when the current user prepared the batch', () => {
    render(<BatchActions {...props} batch={{ status: 'draft', createdById: 'me', payouts: [line()] }} userId="me" />);
    const approve = screen.getByRole('button', { name: /Approve batch/ });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAccessibleDescription(/You prepared this batch, so someone else must approve it/);
    expect(approve.parentElement).toHaveAttribute('title', expect.stringMatching(/separation of duties/));
  });

  it('disables Approve when the current user recommended any line', () => {
    const payouts = [line({ id: 'a' }), line({ id: 'b', recommendedById: 'me' })];
    render(<BatchActions {...props} batch={{ status: 'draft', createdById: 'someone', payouts }} userId="me" />);
    expect(screen.getByRole('button', { name: /Approve batch/ })).toBeDisabled();
    expect(screen.getByText(/You recommended 1 of its lines/)).toBeInTheDocument();
  });

  it('enables Approve for an independent approver', async () => {
    const onApprove = jest.fn();
    render(<BatchActions {...props} onApprove={onApprove} batch={{ status: 'draft', createdById: 'preparer', payouts: [line()] }} userId="approver" />);
    const approve = screen.getByRole('button', { name: /Approve batch/ });
    expect(approve).toBeEnabled();
    await userEvent.setup().click(approve);
    expect(onApprove).toHaveBeenCalled();
  });

  it('hides Approve without finance_approve, and offers payment only once approved', () => {
    const { rerender } = render(<BatchActions {...props} canApprove={false} batch={{ status: 'draft', createdById: 'x', payouts: [] }} userId="me" />);
    expect(screen.queryByRole('button', { name: /Approve batch/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel batch/ })).toBeInTheDocument();

    rerender(<BatchActions {...props} batch={{ status: 'approved', createdById: 'x', payouts: [] }} userId="me" />);
    expect(screen.getByRole('button', { name: /Record payment/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export xlsx/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel batch/ })).not.toBeInTheDocument();
  });

  it('approvalBlockReason mirrors the backend rule', () => {
    expect(approvalBlockReason({ createdById: 'me', payouts: [] }, 'me')).toMatch(/prepared/);
    expect(approvalBlockReason({ createdById: 'x', payouts: [line({ recommendedById: 'me' })] }, 'me')).toMatch(/recommended/);
    expect(approvalBlockReason({ createdById: 'x', payouts: [line()] }, 'me')).toBeNull();
  });

  it('explains a SEPARATION_OF_DUTIES rejection from the server instead of a generic error', async () => {
    const onSubmit = jest.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { success: false, code: 'SEPARATION_OF_DUTIES', message: 'nope' } },
    });
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<ApproveBatchDialog open onClose={onClose} batchNumber="PB-2026-27-0001" count={2} total={2000} onSubmit={onSubmit} />);
    expect(screen.getByRole('dialog', { name: 'Approve PB-2026-27-0001' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Payment batches need a second person/);
    expect(alert).not.toHaveTextContent('nope');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('self-approval allowed by the university', () => {
  it('nobody is blocked; the conflict is still identified', () => {
    expect(approvalBlockReason({ createdById: 'me', payouts: [] }, 'me', true)).toBeNull();
    expect(approvalConflict({ createdById: 'me', payouts: [] }, 'me')).toBe('prepared this batch');
    expect(approvalConflict({ createdById: 'x', payouts: [line({ recommendedById: 'me' }), line({ id: 'l2', recommendedById: 'me' })] }, 'me')).toBe('recommended 2 of its lines');
  });

  it('enables Approve for the preparer', () => {
    render(<BatchActions {...props} allowSelfApproval batch={{ status: 'draft', createdById: 'me', payouts: [line()] }} userId="me" />);
    expect(screen.getByRole('button', { name: /Approve batch/ })).toBeEnabled();
  });

  it('asks the preparer for a reason and sends it', async () => {
    const onSubmit = jest.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<ApproveBatchDialog open onClose={jest.fn()} batchNumber="PB-1" count={1} total={1000} selfConflict="prepared this batch" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Reason for approving your own batch/), 'Sole finance officer this term');
    await user.click(screen.getByRole('button', { name: 'Approve batch' }));
    expect(onSubmit).toHaveBeenCalledWith(undefined, 'Sole finance officer this term');
  });
});
