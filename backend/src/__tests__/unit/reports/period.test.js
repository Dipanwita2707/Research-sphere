const {
  fyStartOf,
  fyLabel,
  parseFyLabel,
  calendarYearOf,
  rangeBounds,
  parseYearRange,
  parseFinancialYears,
  parseEnum,
} = require('../../../modules/reports/utils/period');

describe('reports/period', () => {
  describe('financial-year bucketing (1 April – 31 March, IST)', () => {
    test.each([
      ['2024-04-01T00:00:00+05:30', 2024],
      ['2025-03-31T23:59:59+05:30', 2024],
      ['2025-03-31T18:30:00Z', 2025], // = 1 April 00:00 IST
      ['2025-03-31T18:29:59Z', 2024],
      ['2025-01-15', 2024],
      ['2025-12-31', 2025],
    ])('%s → FY starting %i', (date, start) => {
      expect(fyStartOf(new Date(date))).toBe(start);
    });

    test('null / invalid dates have no year', () => {
      expect(fyStartOf(null)).toBeNull();
      expect(fyStartOf('not a date')).toBeNull();
      expect(calendarYearOf(undefined)).toBeNull();
    });

    test('calendar year uses IST too', () => {
      expect(calendarYearOf(new Date('2024-12-31T19:00:00Z'))).toBe(2025);
    });

    test('labels round-trip', () => {
      expect(fyLabel(2024)).toBe('2024-25');
      expect(fyLabel(1999)).toBe('1999-00');
      expect(parseFyLabel('2024-25')).toBe(2024);
      expect(parseFyLabel('2024-26')).toBeNull();
      expect(parseFyLabel('24-25')).toBeNull();
    });

    test('range bounds are IST midnights', () => {
      const { start, end } = rangeBounds(2023, 2024, 'financial');
      expect(start.toISOString()).toBe('2023-03-31T18:30:00.000Z');
      expect(end.toISOString()).toBe('2025-03-31T18:30:00.000Z');
    });
  });

  describe('parseYearRange', () => {
    const now = new Date().getUTCFullYear();

    test('defaults to the last five years', () => {
      expect(parseYearRange({})).toEqual({ fromYear: now - 4, toYear: now, years: [now - 4, now - 3, now - 2, now - 1, now] });
    });

    test('accepts a valid range', () => {
      expect(parseYearRange({ fromYear: '2022', toYear: '2026' }).years).toEqual([2022, 2023, 2024, 2025, 2026]);
    });

    test.each([
      [{ fromYear: '1999', toYear: '2001' }, /between/],
      [{ fromYear: '2020', toYear: String(now + 2) }, /between/],
      [{ fromYear: '2025', toYear: '2022' }, /after/],
      [{ fromYear: '2010', toYear: '2020' }, /at most 10/],
      [{ fromYear: '20x2', toYear: '2024' }, /four-digit/],
      [{ fromYear: '2022.5', toYear: '2024' }, /four-digit/],
    ])('rejects %j', (query, message) => {
      expect(() => parseYearRange(query)).toThrow(message);
      try { parseYearRange(query); } catch (e) { expect(e.statusCode).toBe(400); }
    });
  });

  describe('parseFinancialYears', () => {
    test('parses, de-duplicates and sorts', () => {
      expect(parseFinancialYears('2024-25, 2023-24,2024-25')).toEqual({ starts: [2023, 2024], labels: ['2023-24', '2024-25'] });
    });

    test('defaults to the last three completed FYs', () => {
      const current = fyStartOf(new Date());
      expect(parseFinancialYears(undefined).starts).toEqual([current - 3, current - 2, current - 1]);
    });

    test.each(['2024-26', 'abc', '1998-99', '2010-11,2024-25'])('rejects %s', (raw) => {
      expect(() => parseFinancialYears(raw)).toThrow();
    });
  });

  test('parseEnum', () => {
    expect(parseEnum(undefined, ['a', 'b'], 'a', 'x')).toBe('a');
    expect(parseEnum('b', ['a', 'b'], 'a', 'x')).toBe('b');
    expect(() => parseEnum('c', ['a', 'b'], 'a', 'x')).toThrow(/x must be one of/);
  });
});
