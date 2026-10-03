import {
  financialYearOf, financialYearOptions, formatINR, formatINRCompact, monthsOfFinancialYear, sourceHref,
} from '../utils/format';
import { authorStatus } from '../views/MyIncentivesView';

describe('finance formatting', () => {
  it('uses the Indian financial year in IST', () => {
    expect(financialYearOf(new Date('2026-10-02T00:00:00Z'))).toBe('2026-27');
    expect(financialYearOf(new Date('2026-03-31T17:00:00Z'))).toBe('2025-26'); // 22:30 IST, still March
    expect(financialYearOf(new Date('2026-03-31T19:00:00Z'))).toBe('2026-27'); // 00:30 IST, 1 April
    expect(financialYearOptions(5, new Date('2026-10-02T00:00:00Z'))).toEqual(['2026-27', '2025-26', '2024-25', '2023-24', '2022-23']);
    expect(monthsOfFinancialYear('2026-27')[0]).toBe('2026-04');
    expect(monthsOfFinancialYear('2026-27')[11]).toBe('2027-03');
  });

  it('formats rupees en-IN', () => {
    expect(formatINR(1234567)).toBe('₹12,34,567');
    expect(formatINR(10.5)).toBe('₹10.50');
    expect(formatINRCompact(1250000)).toBe('₹12.5 L');
    expect(formatINRCompact(25000000)).toBe('₹2.5 Cr');
  });

  it('links to the source record', () => {
    expect(sourceHref({ sourceType: 'research_contribution', sourceId: 'x', researchContributionId: 'c1' })).toBe('/research/contribution/c1');
    expect(sourceHref({ sourceType: 'ipr', sourceId: 'i1', researchContributionId: null })).toBe('/ipr/applications/i1');
    expect(sourceHref({ sourceType: 'grant', sourceId: 'g1', researchContributionId: null })).toBe('/research/grant/g1');
  });

  it('gives authors plain-language statuses', () => {
    expect(authorStatus({ status: 'pending_verification', holdReason: null, paidAt: null, paymentReference: null }).label).toBe('Awaiting finance verification');
    expect(authorStatus({ status: 'on_hold', holdReason: 'Need DOI', paidAt: null, paymentReference: null }).label).toBe('On hold — Need DOI');
    expect(authorStatus({ status: 'paid', holdReason: null, paidAt: '2026-09-30T10:00:00Z', paymentReference: 'UTR123' }).label)
      .toBe('Paid on 30 Sept 2026 (ref UTR123)');
  });
});
