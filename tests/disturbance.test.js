/**
 * Unit tests for the Composite Burn Index (CBI) calculation.
 * Validates strata averaging, composite scoring, and severity
 * classification against known inputs.
 */

import { calculateCBI, cbiL } from '../src/modules/disturbance.js';

describe('calculateCBI', () => {
  test('all-zero input yields Unburned severity and zero composite', () => {
    const { composite, severity, strataAverages } = calculateCBI({});
    expect(composite).toBe(0);
    expect(severity).toBe('Unburned');
    Object.keys(cbiL).forEach(layer => {
      expect(strataAverages[layer]).toBe(0);
    });
  });

  test('averages each stratum over its own field count, not the total field count', () => {
    // overstory has 3 fields, herbaceous has 2 — a uniform value of 3 in
    // each should still average to exactly 3 per stratum regardless of
    // how many fields that stratum has.
    const fieldValues = {};
    Object.values(cbiL).flat().forEach(id => { fieldValues[id] = 3; });
    const { strataAverages, composite } = calculateCBI(fieldValues);
    Object.keys(cbiL).forEach(layer => {
      expect(strataAverages[layer]).toBe(3);
    });
    expect(composite).toBe(3);
  });

  test('missing fields default to 0, not skipped from the average', () => {
    // Only one of overstory's three fields set — average should be 1/3,
    // not the mean of just the provided values.
    const { strataAverages } = calculateCBI({ cbiOverMort: 1 });
    expect(strataAverages.overstory).toBeCloseTo(1 / 3, 5);
  });

  test('severity thresholds match the CBI scale', () => {
    const composite = (v) => calculateCBI(
      Object.fromEntries(Object.values(cbiL).flat().map(id => [id, v]))
    );

    expect(composite(0).severity).toBe('Unburned');
    expect(composite(0.3).severity).toBe('Low');
    expect(composite(1.0).severity).toBe('Moderate-Low');
    expect(composite(2.0).severity).toBe('Moderate-High');
    expect(composite(2.5).severity).toBe('High');
  });

  test('composite score is bounded within the 0-3 CBI scale for max input', () => {
    const fieldValues = {};
    Object.values(cbiL).flat().forEach(id => { fieldValues[id] = 3; });
    const { composite } = calculateCBI(fieldValues);
    expect(composite).toBeLessThanOrEqual(3);
    expect(composite).toBeGreaterThanOrEqual(0);
  });
});
