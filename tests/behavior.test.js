const test = require('node:test');
const assert = require('node:assert/strict');
const { createState, filterBooks, setBookState, setBookProgress, setFeedPreference, togglePreference } = require('../app.js');

const books = [
  { id: 'a', title: 'North Woods', author: 'Daniel Mason', state: 'current' },
  { id: 'b', title: 'James', author: 'Percival Everett', state: 'want' }
];

test('state helpers preserve valid reading data', () => {
  const state = createState({ books: { 'north-woods': { state: 'current', progress: 22 } } });
  assert.equal(state.books['north-woods'].progress, 22);
  assert.equal(setBookState(state, 'north-woods', 'finished').books['north-woods'].state, 'finished');
  assert.equal(setBookProgress(state, 'north-woods', 140).books['north-woods'].progress, 100);
});

test('library filtering matches title, author, and state', () => {
  assert.deepEqual(filterBooks(books, 'mason', 'all').map(book => book.id), ['a']);
  assert.deepEqual(filterBooks(books, '', 'want').map(book => book.id), ['b']);
});

test('feed preferences determine which feed sections are visible', () => {
  const state = setFeedPreference(createState(), 'friends', false);
  assert.equal(state.feed.friends, false);
  assert.equal(state.feed.highlights, true);
});

test('club and list preferences survive state hydration', () => {
  let state = togglePreference(createState(), 'clubs', 'long-table');
  state = togglePreference(state, 'lists', 'small-worlds');
  const restored = createState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.clubs['long-table'], true);
  assert.equal(restored.lists['small-worlds'], true);
});
