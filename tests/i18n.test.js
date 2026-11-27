/**
 * Unit tests for the i18n engine: t()'s dictionary lookup and
 * {placeholder} substitution, and walkDOMAndTranslate()'s text/
 * placeholder/title/aria-label translation.
 *
 * The aria-label case specifically guards against the exact bug found
 * and fixed while building the Invasive Species tool (#28): dozens of
 * aria-labels added in an earlier pass had the translation *mechanism*
 * wired up but no dictionary entry to actually translate from, so they
 * stayed silently stuck in English in every language. A test that
 * asserts a real translation happens — not just that the code runs —
 * is what would have caught that the first time.
 */

import { t, setLanguage, walkDOMAndTranslate } from '../src/modules/i18n.js';

afterEach(() => {
  setLanguage('en');
  document.body.innerHTML = '';
});

describe('t()', () => {
  test('returns the original string in English', () => {
    expect(t('Save')).toBe('Save');
  });

  test('returns the translated string for a known key in a known language', () => {
    setLanguage('fr');
    expect(t('Save')).toBe('Enregistrer');
  });

  test('falls back to the original string when no dictionary entry exists', () => {
    setLanguage('fr');
    expect(t('This string was never added to any dictionary')).toBe('This string was never added to any dictionary');
  });

  test('ignores an unknown target language and stays in English', () => {
    setLanguage('klingon');
    expect(t('Save')).toBe('Save');
  });

  test('substitutes a {placeholder} even with no translation (English)', () => {
    expect(t('Quadrat #{n} saved', { n: 7 })).toBe('Quadrat #7 saved');
  });

  test('substitutes a {placeholder} into the translated template, not the English source', () => {
    setLanguage('fr');
    expect(t('Quadrat #{n} saved', { n: 7 })).toBe('Quadrat #7 enregistré');
  });

  test('leaves a placeholder untouched when its value is not supplied', () => {
    expect(t('Quadrat #{n} saved', {})).toBe('Quadrat #{n} saved');
  });

  test('substitutes every occurrence of a repeated placeholder', () => {
    expect(t('{x} and {x} again', { x: 'A' })).toBe('A and A again');
  });
});

describe('walkDOMAndTranslate()', () => {
  test('translates a text node to the active language', () => {
    document.body.innerHTML = '<button>Save</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    expect(document.querySelector('button').textContent).toBe('Enregistrer');
  });

  test('re-translates from the cached English original, not the already-translated text', () => {
    document.body.innerHTML = '<button>Save</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    setLanguage('es');
    walkDOMAndTranslate();
    expect(document.querySelector('button').textContent).toBe('Guardar');
  });

  test('reverts to English when the language is switched back', () => {
    document.body.innerHTML = '<button>Save</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    setLanguage('en');
    walkDOMAndTranslate();
    expect(document.querySelector('button').textContent).toBe('Save');
  });

  test('translates aria-label the same way it translates text content', () => {
    document.body.innerHTML = '<button aria-label="Settings">⚙</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    expect(document.querySelector('button').getAttribute('aria-label')).toBe('Paramètres');
  });

  test('aria-label reverts to English on switching back, same as text content does', () => {
    document.body.innerHTML = '<button aria-label="Settings">⚙</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    setLanguage('en');
    walkDOMAndTranslate();
    expect(document.querySelector('button').getAttribute('aria-label')).toBe('Settings');
  });

  test('translates an input placeholder', () => {
    document.body.innerHTML = '<input placeholder="Cancel" />';
    setLanguage('fr');
    walkDOMAndTranslate();
    expect(document.querySelector('input').getAttribute('placeholder')).toBe('Annuler');
  });

  test('translates a title tooltip', () => {
    document.body.innerHTML = '<button title="Delete">x</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    expect(document.querySelector('button').getAttribute('title')).toBe('Supprimer');
  });

  test('leaves an attribute with no dictionary entry unchanged', () => {
    document.body.innerHTML = '<button aria-label="Some brand-new label nobody translated yet">x</button>';
    setLanguage('fr');
    walkDOMAndTranslate();
    expect(document.querySelector('button').getAttribute('aria-label')).toBe('Some brand-new label nobody translated yet');
  });
});
