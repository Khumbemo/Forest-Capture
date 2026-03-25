/**
 * Unit Tests for Ecological Analytics
 * Validates all index calculations against known datasets
 */

const EcologicalAnalytics = require('../src/modules/analytics');

describe('EcologicalAnalytics', () => {
  
  // Sample test data
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
    const richness = EcologicalAnalytics.calculateRichness([mockSurvey]);
    expect(richness).toBe(4); // 4 unique species
  });

  test('calculateShannon returns valid diversity value', () => {
    const shannon = EcologicalAnalytics.calculateShannon([mockSurvey]);
    expect(shannon).toBeGreaterThan(0);
    expect(shannon).toBeLessThan(Math.log(4)); // Cannot exceed ln(S)
  });

  test('calculateSimpson returns valid diversity', () => {
    const { lambda, diversity } = EcologicalAnalytics.calculateSimpson([mockSurvey]);
    expect(lambda).toBeGreaterThanOrEqual(0);
    expect(lambda).toBeLessThanOrEqual(1);
    expect(diversity).toBeGreaterThanOrEqual(0);
    expect(diversity).toBeLessThanOrEqual(1);
  });

  test('calculateEvenness returns value between 0 and 1', () => {
    const evenness = EcologicalAnalytics.calculateEvenness([mockSurvey]);
    expect(evenness).toBeGreaterThanOrEqual(0);
    expect(evenness).toBeLessThanOrEqual(1);
  });

  test('calculateIVI returns correct structure', () => {
    const ivi = EcologicalAnalytics.calculateIVI([mockSurvey]);
    expect(Array.isArray(ivi)).toBe(true);
    expect(ivi.length).toBe(4);
    
    ivi.forEach(item => {
      expect(item.species).toBeDefined();
      expect(item.relDensity).toBeGreaterThanOrEqual(0);
      expect(item.relFreq).toBeGreaterThanOrEqual(0);
      expect(item.relDom).toBeGreaterThanOrEqual(0);
      expect(item.ivi).toBeGreaterThanOrEqual(0);
      expect(item.ivi).toBeLessThanOrEqual(300);
    });
  });

  test('calculateIVI sums to ~300', () => {
    const ivi = EcologicalAnalytics.calculateIVI([mockSurvey]);
    const totalIVI = ivi.reduce((sum, item) => sum + item.ivi, 0);
    expect(totalIVI).toBeCloseTo(300, 0);
  });

  test('calculateBasalArea returns non-negative values', () => {
    const ba = EcologicalAnalytics.calculateBasalArea([mockSurvey]);
    expect(ba.totalBasalArea).toBeGreaterThan(0);
    expect(ba.perHectare).toBeGreaterThan(0);
    expect(ba.treeCount).toBeGreaterThan(0);
  });

  test('calculateCBI validates score ranges', () => {
    const cbiData = {
      cbiSubLitter: 1.5,
      cbiSubDuff: 1.0,
      cbiSubSoil: 0.5,
      cbiHerbFreq: 1.0,
      cbiHerbMort: 1.5,
      cbiShrubMort: 2.0,
      cbiShrubChar: 1.5,
      cbiIntChar: 1.0,
      cbiIntMort: 0.5,
      cbiOverScorch: 2.5,
      cbiOverMort: 2.0,
      cbiOverChar: 1.5,
    };
    
    const cbi = EcologicalAnalytics.calculateCBI(cbiData);
    expect(cbi.compositeScore).toBeGreaterThanOrEqual(0);
    expect(cbi.compositeScore).toBeLessThanOrEqual(3);
    expect(['Unburned', 'Low', 'Moderate', 'High']).toContain(cbi.severity);
  });

  test('Shannon equals zero for single species', () => {
    const singleSpecies = {
      quadrats: [{
        size: 100,
        species: [{ name: 'Shorea robusta', abundance: 10 }]
      }]
    };
    const shannon = EcologicalAnalytics.calculateShannon([singleSpecies]);
    expect(shannon).toBe(0);
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
    const evenness = EcologicalAnalytics.calculateEvenness([evenDistribution]);
    expect(evenness).toBeCloseTo(1, 1);
  });
});

// Test runner (if using Jest)
// Run with: npm test