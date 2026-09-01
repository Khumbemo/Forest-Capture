/**
 * Unit tests for the offline (Layer 1) app-guide matcher — deterministic,
 * no network, no model. Every answer must actually address the question
 * it's supposed to catch, and unrelated/empty input must return null so
 * the caller can fall through rather than show a wrong answer confidently.
 */

import { matchOfflineGuide } from '../src/modules/ai-offline-guide.js';

describe('ai-offline-guide', () => {
  test('matches a tool-usage question', () => {
    const answer = matchOfflineGuide('how do I use the CBI tool?');
    expect(answer).toMatch(/Composite Burn Index/);
  });

  test('matches a formula question', () => {
    const answer = matchOfflineGuide("what is Shannon-Wiener diversity index?");
    expect(answer).toMatch(/Shannon-Wiener/);
    expect(answer).toContain('ln(p');
  });

  test('a more specific match wins over a shared, weaker keyword', () => {
    // "dominance index" is Simpson-specific; a query naming it should not
    // fall back to the more generic Shannon entry.
    const answer = matchOfflineGuide("what is Simpson's dominance index?");
    expect(answer).toMatch(/Simpson/);
  });

  test('returns null for unrelated or empty input', () => {
    expect(matchOfflineGuide('what is the weather like on Mars')).toBeNull();
    expect(matchOfflineGuide('')).toBeNull();
    expect(matchOfflineGuide('   ')).toBeNull();
  });
});
