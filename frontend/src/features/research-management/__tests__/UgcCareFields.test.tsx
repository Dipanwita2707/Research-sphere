import React from 'react';
import { render, screen } from '@testing-library/react';
import UgcCareFields, { ugcCareImpliedBy, ugcCarePayload } from '../components/UgcCareFields';

describe('UGC-CARE from indexing categories', () => {
  it('Scopus / WoS categories answer the question as Group II', () => {
    expect(ugcCareImpliedBy(['scie_wos'])).toEqual(['SCIE/SCI (WOS)']);
    expect(ugcCareImpliedBy(['pubmed', 'scopus'])).toEqual(['SCOPUS']);
    expect(ugcCareImpliedBy(['pubmed', 'sgtu_in_house'])).toEqual([]);
    expect(ugcCarePayload('no', '', ['scie_wos'])).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_2' });
  });

  it('other journals keep the author answer', () => {
    expect(ugcCarePayload('yes', 'group_1', ['pubmed'])).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_1' });
    expect(ugcCarePayload('', '', [])).toEqual({ ugcCareListed: null, ugcCareGroup: null });
  });

  it('shows the automatic result instead of the question when SCIE/WOS is ticked', () => {
    render(<UgcCareFields listed="" group="" onChange={jest.fn()} indexingCategories={['scie_wos']} />);
    expect(screen.getByRole('status')).toHaveTextContent('Listed — Group II (Scopus / Web of Science indexed)');
    expect(screen.getByRole('status')).toHaveTextContent('because you selected SCIE/SCI (WOS)');
    expect(screen.queryByText('Is the journal in the UGC-CARE list?')).not.toBeInTheDocument();
  });

  it('asks the question for journals outside Scopus / WoS', () => {
    render(<UgcCareFields listed="" group="" onChange={jest.fn()} indexingCategories={['pubmed']} />);
    expect(screen.getByText('Is the journal in the UGC-CARE list?')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
