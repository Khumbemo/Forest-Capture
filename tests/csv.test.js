/**
 * Unit tests for CSV cell encoding: RFC 4180 quoting and neutralising
 * spreadsheet formula injection without mangling numeric field data.
 */

import { csvCell, toCSVRow } from '../src/modules/utils.js';

describe('csvCell', () => {
  test('quotes plain text and doubles embedded quotes', () => {
    expect(csvCell('Shorea robusta')).toBe('"Shorea robusta"');
    expect(csvCell('the "big" sal')).toBe('"the ""big"" sal"');
  });

  test('keeps commas and newlines inside one quoted cell', () => {
    expect(csvCell('a,b\nc')).toBe('"a,b\nc"');
  });

  test('renders null and undefined as empty cells', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  test.each([
    ['=HYPERLINK("http://x","y")'],
    ['+cmd|\' /C calc\'!A0'],
    ['-2+3+cmd|\' /C calc\'!A0'],
    ['@SUM(1,1)'],
    ['\t=1+1'],
    ['\r=1+1'],
    ['=1+1'],
  ])('neutralises formula payload %j with a leading apostrophe', payload => {
    expect(csvCell(payload).startsWith(`"'`)).toBe(true);
  });

  test.each([
    [-12.5, '"-12.5"'],
    ['-27.1, 88.6', '"-27.1, 88.6"'],
    ['+5', '"+5"'],
    ['1.2e-3', '"1.2e-3"'],
    [0, '"0"'],
  ])('leaves numeric value %j unchanged', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });
});

describe('toCSVRow', () => {
  test('joins encoded cells with commas', () => {
    expect(toCSVRow(['Q1', 400, '=bad'])).toBe('"Q1","400","\'=bad"');
  });
});
