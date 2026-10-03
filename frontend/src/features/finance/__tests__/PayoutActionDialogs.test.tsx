import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdjustDialog, ReasonDialog, RecommendDialog } from '../components/PayoutActionDialogs';

const axiosError = (status: number, data: Record<string, unknown>) => ({ isAxiosError: true, response: { status, data } });

describe('ReasonDialog (hold / cancel)', () => {
  const setup = (onSubmit = jest.fn().mockResolvedValue(undefined), onClose = jest.fn()) => {
    render(
      <ReasonDialog
        open
        onClose={onClose}
        title="Put on hold"
        label="Reason for hold"
        confirmLabel="Put on hold"
        onSubmit={onSubmit}
      />,
    );
    return { onSubmit, onClose, user: userEvent.setup() };
  };

  it('is an accessible modal dialog labelled by its title', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Put on hold' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('requires a reason before it can be submitted', async () => {
    const { onSubmit, user } = setup();
    const submit = screen.getByRole('button', { name: 'Put on hold' });
    const reason = screen.getByLabelText(/Reason for hold/);

    expect(reason).toBeRequired();
    expect(submit).toBeDisabled();

    await user.type(reason, 'ab'); // shorter than the 3-character minimum
    expect(submit).toBeDisabled();
    expect(screen.getByText(/at least 3 characters/)).toBeInTheDocument();

    await user.type(reason, 'c ');
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('abc'));
  });

  it('does not accept a whitespace-only reason', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/Reason for hold/), '     ');
    expect(screen.getByRole('button', { name: 'Put on hold' })).toBeDisabled();
  });

  it('closes on Escape', async () => {
    const { onClose, user } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the server error when the action fails', async () => {
    const onSubmit = jest.fn().mockRejectedValue(axiosError(409, { code: 'INVALID_STATUS', message: 'Only unbatched lines can be put on hold' }));
    const { onClose, user } = setup(onSubmit);
    await user.type(screen.getByLabelText(/Reason for hold/), 'Awaiting proof');
    await user.click(screen.getByRole('button', { name: 'Put on hold' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only unbatched lines can be put on hold');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after a successful submit', async () => {
    const { onClose, user } = setup();
    await user.type(screen.getByLabelText(/Reason for hold/), 'Awaiting proof');
    await user.click(screen.getByRole('button', { name: 'Put on hold' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('AdjustDialog', () => {
  it('shows calculated vs approved and needs a new amount and a reason', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdjustDialog open onClose={jest.fn()} payeeName="Dr. A. Rao" calculatedAmount={25000} approvedAmount={25000} onSubmit={onSubmit} />);

    expect(screen.getByText('Calculated by policy')).toBeInTheDocument();
    expect(screen.getByText('Currently approved')).toBeInTheDocument();
    expect(screen.getAllByText('₹25,000')).toHaveLength(2);

    const save = screen.getByRole('button', { name: 'Save adjustment' });
    expect(save).toBeDisabled(); // amount unchanged, no reason

    const amount = screen.getByLabelText(/New amount/);
    await user.clear(amount);
    await user.type(amount, '20000');
    expect(save).toBeDisabled(); // reason still missing
    expect(screen.getByText(/against the policy amount/)).toHaveTextContent('−₹5,000');

    await user.type(screen.getByLabelText(/^Reason/), 'Quartile corrected to Q2');
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(20000, 'Quartile corrected to Q2'));
  });
});

describe('RecommendDialog', () => {
  it('shows the selection total and allows an optional comment', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecommendDialog open onClose={jest.fn()} count={3} total={123456.5} onSubmit={onSubmit} />);
    expect(screen.getByText('3 lines selected')).toBeInTheDocument();
    expect(screen.getByText('₹1,23,456.50')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recommend 3 lines' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(undefined));
  });
});
