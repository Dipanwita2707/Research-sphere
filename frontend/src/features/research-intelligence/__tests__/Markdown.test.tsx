import { render } from '@testing-library/react';
import { Markdown } from '../components/chat/Markdown';

describe('chat Markdown', () => {
  it('renders <br> inside table cells as line breaks, not as text', () => {
    const md = '| Item | Details |\n|---|---|\n| **Findings** | first point<br>- second point<br/>third |';
    const { container } = render(<Markdown content={md} />);
    const cell = container.querySelectorAll('td')[1];
    expect(cell.textContent).not.toContain('<br');
    expect(cell.querySelectorAll('br')).toHaveLength(2);
  });
});
