import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import ResearchMentorApprovals from './ResearchMentorApprovals';
import { researchService } from '../services/research.service';

const mockAddToast = jest.fn();

jest.mock('@/shared/ui-components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

jest.mock('@/shared/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/shared/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  getResearchDocumentDownloadUrl: (id: string, type: string, name: string) =>
    `/api/v1/research/${id}/documents/${type}/${encodeURIComponent(name)}`,
}));

jest.mock('../services/research.service', () => ({
  researchService: {
    getMentorPendingContributions: jest.fn(),
    mentorApproveContribution: jest.fn(),
    mentorRejectContribution: jest.fn(),
    getContributionById: jest.fn(),
  },
}));

const service = researchService as jest.Mocked<typeof researchService>;

const makeItem = (id: string, title: string, studentName: string, uid: string) => ({
  id,
  title,
  publicationType: 'research_paper',
  status: 'pending_mentor_approval',
  applicationNumber: `RC-2026-${id}`,
  applicantUserId: `user-${id}`,
  journalName: 'Journal of Testing',
  submittedAt: '2026-09-20T10:00:00.000Z',
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
  manuscriptFilePath: JSON.stringify({ s3Key: `research/${id}/paper.pdf`, name: 'paper.pdf', size: 20480 }),
  applicantDetails: { id: `ad-${id}`, researchContributionId: id, uid, mentorUid: 'MENTOR1' },
  authors: [
    { id: `a-${id}`, name: studentName, userId: `user-${id}`, uid, authorType: 'first_author', authorOrder: 1 },
    { id: `b-${id}`, name: 'Co Author', authorType: 'co_author', authorOrder: 2 },
  ],
});

const pending = [
  makeItem('1', 'Graph Neural Networks for Crop Yield', 'Asha Verma', 'STU001'),
  makeItem('2', 'Low-cost Water Purification', 'Rohan Das', 'STU002'),
];

describe('ResearchMentorApprovals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.getMentorPendingContributions.mockResolvedValue(pending as never);
    service.getContributionById.mockResolvedValue({ success: true, data: { statusHistory: [] } } as never);
  });

  it('renders the pending list with student, type and count', async () => {
    const onCount = jest.fn();
    render(<ResearchMentorApprovals onPendingCountChange={onCount} />);

    expect(screen.getAllByTestId('research-mentor-skeleton').length).toBeGreaterThan(0);

    expect(await screen.findByText('Graph Neural Networks for Crop Yield')).toBeInTheDocument();
    expect(screen.getByText('Low-cost Water Purification')).toBeInTheDocument();
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
    expect(screen.getByText('(STU001)')).toBeInTheDocument();
    expect(screen.getAllByText(/Research Paper · Journal of Testing/)).toHaveLength(2);
    expect(onCount).toHaveBeenLastCalledWith(2);
  });

  it('shows documents when details are expanded', async () => {
    render(<ResearchMentorApprovals />);
    const card = await screen.findByTestId('research-pending-1');
    fireEvent.click(within(card).getByRole('button', { name: /view details/i }));

    const link = await within(card).findByRole('link', { name: /download/i });
    expect(link).toHaveAttribute('href', '/api/v1/research/1/documents/manuscript/paper.pdf');
    expect(service.getContributionById).toHaveBeenCalledWith('1');
  });

  it('approve calls the API and removes the item', async () => {
    service.mentorApproveContribution.mockResolvedValue({} as never);
    const onCount = jest.fn();
    render(<ResearchMentorApprovals onPendingCountChange={onCount} />);

    const card = await screen.findByTestId('research-pending-1');
    fireEvent.click(within(card).getByRole('button', { name: /^approve$/i }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/comments/i), { target: { value: 'Looks good' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /approve and forward/i }));

    await waitFor(() => expect(service.mentorApproveContribution).toHaveBeenCalledWith('1', 'Looks good'));
    expect(screen.queryByText('Graph Neural Networks for Crop Yield')).not.toBeInTheDocument();
    expect(screen.getByText('Low-cost Water Purification')).toBeInTheDocument();
    await waitFor(() => expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })));
    expect(onCount).toHaveBeenLastCalledWith(1);
  });

  it('restores the item and shows an error toast when approval fails', async () => {
    service.mentorApproveContribution.mockRejectedValue({ response: { status: 500, data: { message: 'Server exploded' } } });
    render(<ResearchMentorApprovals />);

    const card = await screen.findByTestId('research-pending-1');
    fireEvent.click(within(card).getByRole('button', { name: /^approve$/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /approve and forward/i }));

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: 'Server exploded' })),
    );
    expect(await screen.findByText('Graph Neural Networks for Crop Yield')).toBeInTheDocument();
  });

  it('reject requires a reason before calling the API', async () => {
    service.mentorRejectContribution.mockResolvedValue({} as never);
    render(<ResearchMentorApprovals />);

    const card = await screen.findByTestId('research-pending-2');
    fireEvent.click(within(card).getByRole('button', { name: /request changes/i }));

    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: /send back to student/i });

    fireEvent.click(confirm);
    expect(service.mentorRejectContribution).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/reason/i);
    expect(screen.getByText('Low-cost Water Purification')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: '   ' } });
    fireEvent.click(confirm);
    expect(service.mentorRejectContribution).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: 'Please fix the methodology section' } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(service.mentorRejectContribution).toHaveBeenCalledWith('2', 'Please fix the methodology section'),
    );
    expect(screen.queryByText('Low-cost Water Purification')).not.toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    service.getMentorPendingContributions
      .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Database unavailable' } } })
      .mockResolvedValueOnce([] as never);
    render(<ResearchMentorApprovals />);

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('No Pending Approvals')).toBeInTheDocument();
    expect(service.getMentorPendingContributions).toHaveBeenCalledTimes(2);
  });
});
