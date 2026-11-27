/**
 * Unit tests for fmtCoords() — the decimal-degrees / DMS / UTM
 * coordinate formatter used wherever GPS is displayed (Prism, Herbarium,
 * Invasive Species, the map). Locks in the DD->DMS decomposition math
 * (degrees/minutes/seconds and hemisphere sign) reviewed during the
 * scientific-accuracy audit.
 */

import { fmtCoords } from '../src/modules/gps.js';

describe('fmtCoords', () => {
  test('returns an em dash when coordinates are missing', () => {
    expect(fmtCoords(null, null)).toBe('—');
    expect(fmtCoords(undefined, 10)).toBe('—');
  });

  test('returns an em dash for NaN input rather than "NaN°, NaN°"', () => {
    expect(fmtCoords(NaN, 10)).toBe('—');
  });

  test('decimal degrees format rounds to 5 decimal places', () => {
    expect(fmtCoords(20.5937, 78.9629, 'dd')).toBe('20.59370°, 78.96290°');
  });

  test('decimal degrees is the default format when none is given', () => {
    expect(fmtCoords(1, 2)).toBe('1.00000°, 2.00000°');
  });

  test('DMS format decomposes a round-number coordinate correctly', () => {
    expect(fmtCoords(10, 20, 'dms')).toBe('10°0\'0.0"N 20°0\'0.0"E');
  });

  test('DMS format handles non-zero minutes correctly', () => {
    expect(fmtCoords(11.5, 76.5, 'dms')).toBe('11°30\'0.0"N 76°30\'0.0"E');
  });

  test('DMS format uses S/W for negative latitude/longitude', () => {
    expect(fmtCoords(-10, -20, 'dms')).toBe('10°0\'0.0"S 20°0\'0.0"W');
  });

  test('UTM format produces a zone/easting/northing string without throwing', () => {
    const out = fmtCoords(20.5937, 78.9629, 'utm');
    expect(out).toMatch(/^\d+[A-Z]?N \d+mE \d+mN$/);
  });

  test('UTM format marks the southern hemisphere for negative latitude', () => {
    const out = fmtCoords(-20.5937, 78.9629, 'utm');
    expect(out).toMatch(/^\d+[A-Z]?S /);
  });
});
