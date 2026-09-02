/**
 * Regression test for esc(), the app's general-purpose HTML escaper.
 * The original implementation (round-tripping through textContent /
 * innerHTML) escaped &, <, > but silently left " and ' untouched — safe
 * for element content, but every call site that interpolates esc()'d
 * text into an HTML attribute (e.g. class="stage-badge ${esc(x.stage)}")
 * was vulnerable to attribute-breakout injection. This locks in the fix.
 */

import { esc } from '../src/modules/ui.js';

describe('esc', () => {
  test('escapes all five HTML-significant characters', () => {
    expect(esc('&')).toBe('&amp;');
    expect(esc('<')).toBe('&lt;');
    expect(esc('>')).toBe('&gt;');
    expect(esc('"')).toBe('&quot;');
    expect(esc("'")).toBe('&#39;');
  });

  test('a double-quote payload cannot break out of an attribute value', () => {
    const payload = '" onerror="alert(1)';
    const attr = `<img src="${esc(payload)}" />`;
    expect(attr).not.toContain('onerror="alert(1)"');
    expect(attr).toBe('<img src="&quot; onerror=&quot;alert(1)" />');
  });

  test('a script tag payload cannot inject into element content', () => {
    const payload = '<script>alert(1)</script>';
    expect(esc(payload)).not.toContain('<script>');
  });

  test('passes through ordinary text unchanged', () => {
    expect(esc('Shorea robusta')).toBe('Shorea robusta');
  });

  test('handles null/undefined/non-string input without throwing', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(42)).toBe('42');
  });
});
