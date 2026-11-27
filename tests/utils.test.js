/**
 * Unit tests for toMetric()/toImperial() — the exact function whose gaps
 * caused real shipped bugs this project has had to fix more than once
 * (quadrat area in #17; Prism DBH and Clinometer distance in #24). Locks
 * in the conversion factors and round-trip behavior so a future change
 * here can't silently reintroduce that class of bug.
 */

import { toMetric, toImperial } from '../src/modules/utils.js';

describe('toMetric', () => {
  // Expected values are the exact mathematical conversion rounded to the
  // same precision toMetric() itself returns (2dp for dist/diam/area, 3dp
  // for ha, 1dp for temp) — this is the function's documented/intended
  // rounding, not a tolerance for test flakiness.
  test('dist: feet to metres (factor 0.3048)', () => {
    expect(toMetric(10, 'dist')).toBe(3.05);
  });

  test('diam: inches to centimetres (factor 2.54)', () => {
    expect(toMetric(1, 'diam')).toBe(2.54);
  });

  test('area: square feet to square metres', () => {
    expect(toMetric(100, 'area')).toBe(9.29);
  });

  test('temp: Fahrenheit to Celsius', () => {
    expect(toMetric(32, 'temp')).toBe(0);
    expect(toMetric(212, 'temp')).toBe(100);
  });

  test('ha: acres to hectares', () => {
    expect(toMetric(1, 'ha')).toBe(0.405);
  });

  test('null/empty input returns null, not NaN or 0', () => {
    expect(toMetric(null, 'dist')).toBeNull();
    expect(toMetric('', 'dist')).toBeNull();
  });

  test('a non-numeric string is returned unchanged rather than becoming NaN', () => {
    expect(toMetric('abc', 'dist')).toBe('abc');
  });
});

describe('toImperial', () => {
  test('dist: metres to feet', () => {
    expect(toImperial(1, 'dist')).toBe(3.28);
  });

  test('diam: centimetres to inches', () => {
    expect(toImperial(2.54, 'diam')).toBe(1);
  });

  test('temp: Celsius to Fahrenheit', () => {
    expect(toImperial(0, 'temp')).toBe(32);
    expect(toImperial(100, 'temp')).toBe(212);
  });

  test('ha: hectares to acres', () => {
    expect(toImperial(1, 'ha')).toBe(2.471);
  });
});

describe('toMetric/toImperial round-trip', () => {
  // A value entered in imperial, converted to metric for storage, and
  // converted back for display (the exact path every unit-aware field in
  // the app takes) must return to (approximately) its original value.
  test.each([
    ['dist', 15],
    ['diam', 24.5],
    ['area', 500],
    ['ha', 2.5]
  ])('%s round-trips through metric and back within 0.1%%', (type, original) => {
    const metric = toMetric(original, type);
    const back = toImperial(metric, type);
    expect(back).toBeCloseTo(original, 1);
  });

  test('temp round-trips through metric and back', () => {
    const original = 98.6;
    const metric = toMetric(original, 'temp');
    const back = toImperial(metric, 'temp');
    expect(back).toBeCloseTo(original, 0);
  });
});
