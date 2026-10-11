/**
 * Regression test for csvQuoteCell(), exportCalculations()'s cell quoting
 * helper. It used to wrap every cell in quotes without escaping embedded
 * double quotes, so a survey name containing a `"` produced a malformed
 * CSV row that spreadsheet software split into the wrong number of
 * columns. Fixed to double up embedded quotes per RFC 4180.
 */

import { csvQuoteCell } from '../src/modules/calculation.js';

describe('csvQuoteCell', () => {
  test('wraps an ordinary value in quotes', () => {
    expect(csvQuoteCell('Test Survey')).toBe('"Test Survey"');
  });

  test('escapes embedded double quotes by doubling them', () => {
    expect(csvQuoteCell('6" Plot Survey')).toBe('"6"" Plot Survey"');
  });

  test('a value with an embedded quote still forms exactly one CSV cell', () => {
    const row = ['Survey Name', '6" Plot Survey'].map(csvQuoteCell).join(',');
    // Splitting naively on unescaped quote-comma boundaries should yield
    // exactly two cells, not three (which is what the pre-fix output did).
    const cells = row.match(/"(?:[^"]|"")*"/g);
    expect(cells).toHaveLength(2);
    expect(cells[1]).toBe('"6"" Plot Survey"');
  });

  test('handles non-string values', () => {
    expect(csvQuoteCell(42)).toBe('"42"');
    expect(csvQuoteCell(0)).toBe('"0"');
  });
});
