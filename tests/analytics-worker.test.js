/**
 * Regression test for the analytics worker's requestId round-trip.
 *
 * refreshAnalytics() (src/modules/analytics.js) reassigns the worker's
 * onmessage handler on every call, closing over the survey passed to that
 * call. If the user reopened Analytics for a different survey before the
 * previous computation finished, a stale response used to render
 * alongside the new one. The fix has the worker echo back a requestId (and
 * the quadrats it computed from) so a handler can tell a stale response
 * apart from the one it's waiting for.
 */

let posted;

beforeAll(() => {
  // The worker script attaches its message listener once, to the shared
  // jsdom `self`; load it exactly once for this file rather than per test.
  self.postMessage = (msg) => posted.push(msg);
  require('../src/workers/analytics.worker.js');
});

beforeEach(() => {
  posted = [];
});

describe('analytics.worker requestId echo', () => {
  test('echoes back the requestId and the quadrats it computed from', () => {
    const survey = { quadrats: [{ number: 1, species: [{ name: 'Shorea robusta', abundance: 2 }] }] };

    self.dispatchEvent(new MessageEvent('message', { data: { survey, requestId: 7 } }));

    expect(posted).toHaveLength(1);
    expect(posted[0].requestId).toBe(7);
    expect(posted[0].quadrats).toEqual(survey.quadrats);
  });

  test('a second, later request gets its own requestId back, distinguishable from the first', () => {
    const surveyA = { quadrats: [{ number: 1, species: [] }] };
    const surveyB = { quadrats: [{ number: 1, species: [] }, { number: 2, species: [] }] };

    self.dispatchEvent(new MessageEvent('message', { data: { survey: surveyA, requestId: 1 } }));
    self.dispatchEvent(new MessageEvent('message', { data: { survey: surveyB, requestId: 2 } }));

    expect(posted).toHaveLength(2);
    expect(posted[0].requestId).toBe(1);
    expect(posted[1].requestId).toBe(2);
    // A caller keyed on the latest requestId (2) would correctly ignore
    // posted[0] as stale, and posted[1].quadrats reflects surveyB, not A.
    expect(posted[1].quadrats).toEqual(surveyB.quadrats);
  });
});
