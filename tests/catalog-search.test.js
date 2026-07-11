const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOKS,
  buildCatalogSearchUrl,
  normalizeCatalogDocs,
  mergeSearchResults,
  getSearchPresentation,
  createCatalogSearchController
} = require('../app.js');

test('catalog URL requests only the required Open Library fields', () => {
  const url = new URL(buildCatalogSearchUrl('  octavia butler  '));
  assert.equal(url.origin + url.pathname, 'https://openlibrary.org/search.json');
  assert.equal(url.searchParams.get('q'), 'octavia butler');
  assert.equal(url.searchParams.get('limit'), '20');
  assert.equal(url.searchParams.get('fields'), 'key,title,author_name,cover_i,first_publish_year');
});

test('catalog normalization rejects malformed docs and supplies safe fallbacks', () => {
  const results = normalizeCatalogDocs([
    { key: '/works/OL1W', title: 'Kindred', author_name: ['Octavia E. Butler'], cover_i: 123, first_publish_year: 1979 },
    { key: '/works/OL2W', title: 'No Author', author_name: [], cover_i: 'bad', first_publish_year: 'unknown' },
    { key: '', title: 'Missing key' },
    null
  ]);
  assert.deepEqual(results, [
    { id: 'ol:/works/OL1W', key: '/works/OL1W', title: 'Kindred', author: 'Octavia E. Butler', coverId: 123, year: 1979, source: 'catalog' },
    { id: 'ol:/works/OL2W', key: '/works/OL2W', title: 'No Author', author: 'Unknown author', coverId: null, year: null, source: 'catalog' }
  ]);
});

test('merged search keeps local matches first and deduplicates equivalent works', () => {
  const local = [Object.assign({}, BOOKS[1], { state: 'want' })];
  const remote = [
    { id: 'ol:/works/duplicate', key: '/works/duplicate', title: 'James', author: 'Percival Everett', source: 'catalog' },
    { id: 'ol:/works/new', key: '/works/new', title: 'Kindred', author: 'Octavia Butler', source: 'catalog' }
  ];
  assert.deepEqual(mergeSearchResults(local, remote).map(book => book.id), ['james', 'ol:/works/new']);
});

test('shelf-specific search stays local-only even when catalog results exist', () => {
  const local = [{ id: 'local', title: 'Kindred', author: 'Octavia Butler' }];
  const remote = [{ id: 'remote', title: 'Parable of the Sower', author: 'Octavia Butler', source: 'catalog' }];
  const presentation = getSearchPresentation({ query: 'butler', filter: 'want', localResults: local, catalogResults: remote, catalogStatus: 'success' });
  assert.deepEqual(presentation.results.map(book => book.id), ['local']);
  assert.equal(presentation.countText, '1 local match · Want to Read shelf only');
  assert.equal(presentation.statusText, 'Open Library search is available only in All books.');
});

test('search wording reflects loading, success, error, and completed zero-result states', () => {
  const local = [{ id: 'local', title: 'Kindred', author: 'Octavia Butler' }];
  const loading = getSearchPresentation({ query: 'kindred', filter: 'all', localResults: local, catalogResults: [], catalogStatus: 'loading' });
  assert.equal(loading.countText, '1 local match · searching Open Library…');
  assert.equal(loading.emptyVisible, false);

  const success = getSearchPresentation({ query: 'kindred', filter: 'all', localResults: local, catalogResults: [{ id: 'remote', title: 'Kindred Graphic Novel', author: 'Damian Duffy', source: 'catalog' }], catalogStatus: 'success' });
  assert.equal(success.countText, '2 results · your library first, then Open Library');

  const error = getSearchPresentation({ query: 'kindred', filter: 'all', localResults: local, catalogResults: [], catalogStatus: 'error' });
  assert.equal(error.countText, '1 local match only');

  const empty = getSearchPresentation({ query: 'zzzzzzz', filter: 'all', localResults: [], catalogResults: [], catalogStatus: 'success' });
  assert.equal(empty.emptyVisible, true);
  assert.equal(empty.statusText, 'No library or Open Library results found for “zzzzzzz”.');
});

test('search controller ignores short queries and debounces catalog requests', async () => {
  const calls = [];
  const timers = [];
  const controller = createCatalogSearchController({
    fetchImpl: async url => { calls.push(url); return { ok: true, json: async () => ({ docs: [] }) }; },
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimer: () => {}
  });
  controller.search('a', () => {});
  assert.equal(timers.length, 0);
  controller.search('kindred', () => {});
  assert.equal(timers[0].delay, 300);
  await timers[0].fn();
  assert.equal(calls.length, 1);
});

test('search controller aborts prior work and sequence-guards stale responses', async () => {
  const pending = [];
  const events = [];
  const timers = [];
  class FakeAbortController { constructor() { this.signal = {}; this.aborted = false; } abort() { this.aborted = true; } }
  const controller = createCatalogSearchController({
    fetchImpl: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })),
    AbortControllerImpl: FakeAbortController,
    setTimer: fn => { timers.push(fn); return timers.length; },
    clearTimer: () => {}
  });
  controller.search('first', event => events.push(event));
  const firstRun = timers.shift()();
  controller.search('second', event => events.push(event));
  assert.equal(pending[0].options.signal != null, true);
  const secondRun = timers.shift()();
  pending[1].resolve({ ok: true, json: async () => ({ docs: [{ key: '/works/2', title: 'Second' }] }) });
  await secondRun;
  pending[0].resolve({ ok: true, json: async () => ({ docs: [{ key: '/works/1', title: 'First' }] }) });
  await firstRun;
  assert.equal(events.filter(event => event.status === 'success').length, 1);
  assert.equal(events.find(event => event.status === 'success').results[0].title, 'Second');
});

test('search controller reports API failure for local fallback', async () => {
  const events = [];
  const timers = [];
  const controller = createCatalogSearchController({
    fetchImpl: async () => { throw new TypeError('offline'); },
    setTimer: fn => { timers.push(fn); return 1; }, clearTimer: () => {}
  });
  controller.search('kindred', event => events.push(event));
  await timers[0]();
  assert.deepEqual(events.map(event => event.status), ['loading', 'error']);
});
