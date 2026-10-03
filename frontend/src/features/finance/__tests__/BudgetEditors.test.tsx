import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllocationEditor, DistributeEditor } from '../budget/components/BudgetEditors';
import type { BudgetNode } from '../budget/types';

const CYCLE = { id: 'cccccccc-0000-4000-8000-000000002627', name: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31' };

const mockSave = jest.fn();
jest.mock('../budget/useBudget', () => ({
  useSaveAllocation: () => ({ mutateAsync: mockSave, isPending: false }),
  useSaveBudget: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/shared/ui-components/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

const node = (over: Partial<BudgetNode>): BudgetNode => ({
  nodeType: 'school', id: 's1', name: 'School of Engineering', code: 'SOE', parentId: 'u', isActive: true, allocationId: 'a1', hasAllocation: true,
  categoryAllocations: {}, categories: [], externalFunding: { amount: 0, count: 0 }, updatedAt: null, children: [],
  allocated: 400000, committed: 0, utilised: 0, pending: 0, consumed: 0, available: 400000, utilisationPct: 0, lines: 0, status: 'healthy',
  childrenAllocated: 100000, ...over,
});

beforeEach(() => mockSave.mockReset().mockResolvedValue({}));

describe('AllocationEditor', () => {
  const setup = () => {
    render(<AllocationEditor cycle={CYCLE} node={node({})} parentAmount={1000000} siblingsTotal={500000} parentLabel="the university budget" />);
    return userEvent.setup();
  };

  it('blocks amounts above what the parent has left and explains why', async () => {
    const user = setup();
    const amount = screen.getByLabelText(/Allocation for FY 2026-27/);
    await user.clear(amount);
    await user.type(amount, '600000');
    await user.type(screen.getByLabelText(/Reason for the change/), 'More money');
    await user.click(screen.getByRole('button', { name: /Save allocation/ }));
    expect(await screen.findByText(/At most ₹5,00,000 is left/)).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('cannot go below the departments, needs a reason for a change, then saves', async () => {
    const user = setup();
    const amount = screen.getByLabelText(/Allocation for FY 2026-27/);
    await user.clear(amount);
    await user.type(amount, '50000');
    await user.click(screen.getByRole('button', { name: /Save allocation/ }));
    expect(await screen.findByText(/already given to its departments/)).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '450000');
    await user.click(screen.getByRole('button', { name: /Save allocation/ }));
    expect(await screen.findByText(/Give a reason for the change/)).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Reason for the change/), 'Mid-year revision');
    await user.click(screen.getByRole('button', { name: /Save allocation/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({
      nodeType: 'school', nodeId: 's1', amount: 450000, categoryAllocations: {}, reason: 'Mid-year revision',
    }));
  });

  it('shows the server message when the backend refuses', async () => {
    mockSave.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { code: 'EXCEEDS_PARENT', message: 'Server says no' } } });
    const user = setup();
    const amount = screen.getByLabelText(/Allocation for FY 2026-27/);
    await user.clear(amount);
    await user.type(amount, '450000');
    await user.type(screen.getByLabelText(/Reason for the change/), 'Because');
    await user.click(screen.getByRole('button', { name: /Save allocation/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server says no');
  });
});

describe('DistributeEditor', () => {
  const parent = node({
    nodeType: 'university', id: 'u', name: 'Test University', allocated: 1000000, childrenAllocated: 300000,
    children: [
      node({ id: 's1', name: 'School A', allocated: 300000, hasAllocation: true, childrenAllocated: 0 }),
      node({ id: 's2', name: 'School B', allocated: 0, hasAllocation: false, childrenAllocated: 0 }),
    ],
  });

  it('shows the unallocated remainder live and refuses to over-allocate', async () => {
    const user = userEvent.setup();
    render(<DistributeEditor cycle={CYCLE} parent={parent} />);
    expect(screen.getByText('Unallocated remainder')).toBeInTheDocument();
    expect(screen.getByText('₹7,00,000')).toBeInTheDocument();
    const b = screen.getByLabelText('Allocation for School B');
    await user.type(b, '800000');
    expect(screen.getByText('Over-allocated by')).toBeInTheDocument();
    expect(screen.getByText('₹1,00,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save distribution/ })).toBeDisabled();
  });

  it('saves only changed rows, decreases first, with the reason for existing ones', async () => {
    const user = userEvent.setup();
    render(<DistributeEditor cycle={CYCLE} parent={parent} />);
    const a = screen.getByLabelText('Allocation for School A');
    await user.clear(a);
    await user.type(a, '200000');
    await user.type(screen.getByLabelText('Allocation for School B'), '500000');
    await user.type(screen.getByLabelText(/Reason for the change/), 'Rebalance');
    await user.click(screen.getByRole('button', { name: /Save distribution/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(mockSave.mock.calls[0][0]).toMatchObject({ nodeId: 's1', amount: 200000, reason: 'Rebalance' });
    expect(mockSave.mock.calls[1][0]).toMatchObject({ nodeId: 's2', amount: 500000 });
  });
});
