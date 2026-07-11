const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('first draft contains the core product surfaces', () => {
  const html = read('index.html');
  for (const marker of [
    'Read With Me', 'For you', 'My library', 'Discover', 'Shop', 'Clubs',
    'Currently Reading', 'Want to Read', 'Did Not Finish', 'Preview',
    'Buy on Bookshop.org', 'Customize feed', 'Book details'
  ]) assert.match(html, new RegExp(marker, 'i'), `missing ${marker}`);
});

test('navigation and interactive controls have stable hooks', () => {
  const html = read('index.html');
  for (const hook of [
    'data-view="home"', 'data-view="library"', 'data-view="discover"',
    'data-view="shop"', 'data-view="clubs"', 'data-book-id',
    'id="searchInput"', 'id="feedSettings"', 'id="mobileNav"'
  ]) assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('site is accessible and honest about draft behavior', () => {
  const html = read('index.html');
  assert.match(html, /<main[^>]+id="mainContent"/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /demo data|preview data/i);
  assert.match(html, /affiliate/i);
  assert.doesNotMatch(html, /href="#"/);
});

test('deployment files target the approved domain and support deep links', () => {
  assert.equal(read('CNAME').trim(), 'readwithme.cc');
  assert.equal(read('404.html'), read('index.html'));
});

test('scripts expose local interactive state and avoid unsafe HTML sinks', () => {
  const js = read('app.js');
  for (const marker of ['localStorage', 'setView', 'setReadingState', 'updateProgress', 'toggleFeedSettings']) {
    assert.match(js, new RegExp(marker));
  }
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
});

test('styles include responsive mobile navigation and reduced-motion support', () => {
  const css = read('styles.css');
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.mobile-nav/);
});

test('deep-link mirror uses root-relative application assets', () => {
  const html = read('index.html');
  assert.match(html, /href="\/styles\.css"/);
  assert.match(html, /src="\/app\.js"/);
});

test('all interactive elements receive a visible keyboard focus treatment', () => {
  const css = read('styles.css');
  assert.match(css, /:focus-visible[^}]*outline\s*:/);
  assert.match(css, /:focus-visible[^}]*outline-offset\s*:/);
});

test('feed sections and persisted actions have stable semantic hooks', () => {
  const html = read('index.html');
  for (const hook of ['data-feed-section="friends"', 'data-feed-section="highlights"', 'data-feed-section="shelf"', 'data-join-club="long-table"', 'data-save-list="small-worlds"']) assert.match(html, new RegExp(hook));
});

test('active controls expose pressed/current state and hero page count is consistent', () => {
  const html = read('index.html');
  assert.match(html, /data-view="home"[^>]+aria-current="page"/);
  assert.match(html, /data-filter="all"[^>]+aria-pressed="true"/);
  assert.match(html, /id="heroPage"/);
});
