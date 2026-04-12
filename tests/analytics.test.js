/**
 * Unit Tests for Ecological Analytics
 * Validates all index calculations against known datasets
 */

import { calculateIndicesPayload } from '../src/modules/analytics.js';

describe('EcologicalAnalytics', () => {

  const mockSurvey = {
    id: 'survey-1',
    name: 'Test Survey',
    quadrats: [
      {
        number: 1,
        size: 100,
        species: [
          { name: 'Shorea robusta', abundance: 5, dbh: 45.2, stage: 'tree' },
          { name: 'Tectona grandis', abundance: 3, dbh: 38.5, stage: 'tree' },
          { name: 'Dalbergia sissoo', abundance: 2, dbh: 28.0, stage: 'tree' },
        ]
      },
      {
        number: 2,
        size: 100,
        species: [
          { name: 'Shorea robusta', abundance: 4, dbh: 42.1, stage: 'tree' },
          { name: 'Adina cordifolia', abundance: 2, dbh: 35.0, stage: 'tree' },
        ]
      }
    ]
  };

  test('calculateRichness returns correct species count', () => {
    const { S } = calculateIndicesPayload(mockSurvey);
    expect(S).toBe(4); // 4 unique species
  });

  test('Shannon H returns valid diversity value', () => {
    const { H } = calculateIndicesPayload(mockSurvey);
    expect(H).toBeGreaterThan(0);
    expect(H).toBeLessThan(Math.log(4));
  });

  test('Simpson D returns valid dominance', () => {
    const { D } = calculateIndicesPayload(mockSurvey);
    expect(D).toBeGreaterThanOrEqual(0);
    expect(D).toBeLessThanOrEqual(1);
  });

  test('Evenness E returns value between 0 and 1', () => {
    const { E } = calculateIndicesPayload(mockSurvey);
    expect(E).toBeGreaterThan(0);
    expect(E).toBeLessThanOrEqual(1);
  });

  test('calculateIVI returns correct structure', () => {
    const { iviData } = calculateIndicesPayload(mockSurvey);
    expect(Array.isArray(iviData)).toBe(true);
    expect(iviData.length).toBe(4);

    iviData.forEach(item => {
      expect(item.name).toBeDefined();
      expect(item.relDensity).toBeGreaterThanOrEqual(0);
      expect(item.relFreq).toBeGreaterThanOrEqual(0);
      expect(item.relDom).toBeGreaterThanOrEqual(0);
      expect(item.ivi).toBeGreaterThanOrEqual(0);
      expect(item.ivi).toBeLessThanOrEqual(300);
    });
  });

  test('calculateIVI sums to ~300', () => {
    const { iviData } = calculateIndicesPayload(mockSurvey);
    const totalIVI = iviData.reduce((sum, item) => sum + item.ivi, 0);
    expect(totalIVI).toBeCloseTo(300, 0); // close to 300
  });

  test('calculateBasalArea returns non-negative values', () => {
    const { totalBA, totalArea } = calculateIndicesPayload(mockSurvey);
    expect(totalBA).toBeGreaterThan(0);
    expect(totalArea).toBeGreaterThan(0);
  });

  test('Shannon equals zero for single species', () => {
    const singleSpecies = {
      quadrats: [{
        size: 100,
        species: [{ name: 'Shorea robusta', abundance: 10 }]
      }]
    };
    const { H } = calculateIndicesPayload(singleSpecies);
    expect(H).toBe(0);
  });

  test('Evenness equals 1 for perfectly even distribution', () => {
    const evenDistribution = {
      quadrats: [{
        size: 100,
        species: [
          { name: 'Species A', abundance: 5 },
          { name: 'Species B', abundance: 5 },
        ]
      }]
    };
    const { E } = calculateIndicesPayload(evenDistribution);
    expect(E).toBeCloseTo(1, 1);
  });
});