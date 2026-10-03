import React from 'react';
import { render, screen } from '@testing-library/react';
import { RipGate } from '../components/shared/RipStates';
import { useRipAccess } from '../hooks/useRipAccess';

jest.mock('../hooks/useRipAccess', () => ({ useRipAccess: jest.fn() }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

const mocked = useRipAccess as jest.Mock;
const perms = (granted: string[]) =>
  Object.fromEntries(['rip_view_knowledge_graph', 'rip_view_keyword_intelligence', 'rip_access_research_gpt'].map((k) => [k, granted.includes(k)]));

const renderGate = () =>
  render(
    <RipGate anyOf={['rip_view_knowledge_graph']} feature="the collaboration network" capability="Knowledge graph & experts">
      <p>secret graph</p>
    </RipGate>
  );

describe('RipGate', () => {
  afterEach(() => mocked.mockReset());

  it('renders the view when the capability is held', () => {
    mocked.mockReturnValue({ data: { enabled: true, permissions: perms(['rip_view_knowledge_graph']) }, isLoading: false, isError: false });
    renderGate();
    expect(screen.getByText('secret graph')).toBeInTheDocument();
  });

  it('explains missing access instead of rendering the view', () => {
    mocked.mockReturnValue({ data: { enabled: true, permissions: perms(['rip_access_research_gpt']) }, isLoading: false, isError: false });
    renderGate();
    expect(screen.queryByText('secret graph')).not.toBeInTheDocument();
    expect(screen.getByText("You don't have access to the collaboration network")).toBeInTheDocument();
    expect(screen.getByText('Knowledge graph & experts')).toBeInTheDocument();
  });

  it('says when the module is switched off', () => {
    mocked.mockReturnValue({ data: { enabled: false, permissions: perms(['rip_view_knowledge_graph']) }, isLoading: false, isError: false });
    renderGate();
    expect(screen.getByText('Research Intelligence is not enabled')).toBeInTheDocument();
    expect(screen.queryByText('secret graph')).not.toBeInTheDocument();
  });

  it('offers a retry when access cannot be checked', () => {
    const refetch = jest.fn();
    mocked.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    renderGate();
    screen.getByRole('button', { name: /try again/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it('shows a skeleton while loading', () => {
    mocked.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = renderGate();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('secret graph')).not.toBeInTheDocument();
  });
});
