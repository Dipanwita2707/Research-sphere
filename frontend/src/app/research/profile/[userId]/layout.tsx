import type { Metadata } from 'next';
import './critical.css';

export const metadata: Metadata = {
  title: 'Research Profile - SGT University',
  description: 'Researcher profile with publications, citations, and collaboration network',
};

export default function ResearchProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
