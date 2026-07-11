const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DISCOVERY_SHELVES,
  MAX_SEARCH_PAGES,
  buildCatalogSearchUrl,
  buildDiscoveryUrl,
  mergeCatalogPages,
  createCatalogSearchController,
  createDiscoveryController
} = require('../app.js');

test('catalog pagination is bounded and URLs include the requested page', () => {
  assert.equal(MAX_SEARCH_PAGES, 5);
  const url = new URL(buildCatalogSearchUrl('ursula le guin', 3));
  assert.equal(url.searchParams.get('page'), '3');
  const bounded = new URL(buildCatalogSearchUrl('ursula le guin', 999));
  assert.equal(bounded.searchParams.get('page'), '5');
});

test('catalog pages deduplicate by Open Library key and equivalent work', () => {
  const first = [{ id: 'ol:/works/1', key: '/works/1', title: 'Kindred', author: 'Octavia Butler' }];
  const second = [
    { id: 'ol:/works/1', key: '/works/1', title: 'Kindred', author: 'Octavia Butler' },
    { id: 'ol:/works/2', key: '/works/2', title: 'KINDRED', author: 'Octavia Butler' },
    { id: 'ol:/works/3', key: '/works/3', title: 'Parable of the Sower', author: 'Octavia Butler' }
  ];
  assert.deepEqual(mergeCatalogPages(first, second).map(book => book.id), ['ol:/works/1', 'ol:/works/3']);
});

test('search controller loads sequential pages and reports bounded pagination metadata', async () => {
  const calls = [];
  const events = [];
  const timers = [];
  const controller = createCatalogSearchController({
    fetchImpl: async url => {
      calls.push(new URL(url));
      return { ok: true, json: async () => ({ numFound: 1000, docs: [{ key: `/works/${calls.length}`, title: `Book ${calls.length}` }] }) };
    },
    setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {}
  });
  controller.search('books', event => events.push(event));
  await timers[0]();
  await controller.loadMore(event => events.push(event));
  assert.deepEqual(calls.map(url => url.searchParams.get('page')), ['1', '2']);
  const success = events.filter(event => event.status === 'success');
  assert.deepEqual(success.at(-1).results.map(book => book.title), ['Book 1', 'Book 2']);
  assert.equal(success.at(-1).page, 2);
  assert.equal(success.at(-1).hasMore, true);
});

test('rapid load-more calls share one pending request and never request the same page twice', async () => {
  const calls = [];
  const timers = [];
  let resolveSecondPage;
  const controller = createCatalogSearchController({
    fetchImpl: async url => {
      const parsed = new URL(url);
      calls.push(parsed);
      const page = parsed.searchParams.get('page');
      if (page === '2') await new Promise(resolve => { resolveSecondPage = resolve; });
      return { ok: true, json: async () => ({ numFound: 1000, docs: [{ key: `/works/${page}`, title: `Book ${page}` }] }) };
    },
    setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {}
  });
  controller.search('books', () => {});
  await timers[0]();

  const firstLoad = controller.loadMore(() => {});
  const secondLoad = controller.loadMore(() => {});
  assert.equal(firstLoad, secondLoad, 'a pending load-more request should be reused');
  assert.deepEqual(calls.map(url => url.searchParams.get('page')), ['1', '2']);

  resolveSecondPage();
  await Promise.all([firstLoad, secondLoad]);
  assert.deepEqual(calls.map(url => url.searchParams.get('page')), ['1', '2']);
});

test('discovery defines four honest, bounded Open Library shelves', () => {
  assert.equal(DISCOVERY_SHELVES.length, 4);
  assert.deepEqual(DISCOVERY_SHELVES.map(shelf => shelf.id), ['reader-favorites', 'literary-fiction', 'science-fiction', 'biography']);
  assert.deepEqual(DISCOVERY_SHELVES[0], {
    id: 'reader-favorites',
    title: 'Reader favorites',
    description: 'Frequently logged fiction works in Open Library.',
    query: 'subject:fiction',
    sort: 'readinglog'
  });
  for (const shelf of DISCOVERY_SHELVES) {
    const url = new URL(buildDiscoveryUrl(shelf));
    assert.equal(url.origin + url.pathname, 'https://openlibrary.org/search.json');
    assert.equal(url.searchParams.get('limit'), '10');
    assert.match(url.searchParams.get('q'), /subject:/);
  }
});

test('discovery fetches shelves in parallel, caches results in memory, and degrades per shelf', async () => {
  const pending = [];
  const calls = [];
  const controller = createDiscoveryController({
    fetchImpl: url => new Promise((resolve, reject) => { calls.push(url); pending.push({ resolve, reject }); })
  });
  const first = controller.load();
  assert.equal(calls.length, 4, 'all shelf requests should start before any resolves');
  pending[0].resolve({ ok: true, json: async () => ({ docs: [{ key: '/works/1', title: 'One' }] }) });
  pending[1].reject(new TypeError('offline'));
  pending[2].resolve({ ok: true, json: async () => ({ docs: [{ key: '/works/3', title: 'Three' }] }) });
  pending[3].resolve({ ok: true, json: async () => ({ docs: [{ key: '/works/4', title: 'Four' }] }) });
  const shelves = await first;
  assert.equal(shelves[0].status, 'success');
  assert.equal(shelves[1].status, 'error');
  await controller.load();
  assert.equal(calls.length, 4, 'second load should use the session cache');
});
