import React from 'react';
import { render, screen } from '@testing-library/react';
import CollaborationNetworkTab from '@/features/research-profile/components/CollaborationNetworkTab';
import { useRipAccess } from '../hooks/useRipAccess';

jest.mock('../hooks/useRipAccess', () => ({ useRipAccess: jest.fn() }));
jest.mock('next/navigation', () => ({ useParams: () => ({ userId: '1a3804d1-97d6-4ea2-a25a-e49949370a74' }) }));
jest.mock('next/dynamic', () => () => function NetworkStub() {
  return <div data-testid="network" />;
});
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

const mocked = useRipAccess as jest.Mock;
const coAuthors = [
  { id: 'x', name: 'Dr X', affiliation: 'SGT University, India', collaborationCount: 3, scopusAuthorId: null },
] as never[];

describe('CollaborationNetworkTab full network report', () => {
  it('links to the Research Intelligence ego network when the viewer has graph access', () => {
    mocked.mockReturnValue({ can: (k: string) => k === 'rip_view_knowledge_graph' });
    render(<CollaborationNetworkTab coAuthors={coAuthors} mainAuthorName="Dr A" />);
    expect(screen.getByRole('link', { name: /view full network report/i })).toHaveAttribute(
      'href',
      '/research/intelligence/network?userId=1a3804d1-97d6-4ea2-a25a-e49949370a74'
    );
  });

  it('hides the button without graph access', () => {
    mocked.mockReturnValue({ can: () => false });
    render(<CollaborationNetworkTab coAuthors={coAuthors} mainAuthorName="Dr A" />);
    expect(screen.queryByText(/view full network report/i)).not.toBeInTheDocument();
  });
});
