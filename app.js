(function (root) {
  'use strict';

  const STORAGE_KEY = 'readWithMe.preview.v1';
  const BOOKS = [
    { id: 'north-woods', title: 'North Woods', author: 'Daniel Mason', isbn: '9780593597033', state: 'current', progress: 39, description: 'A sweeping story of one New England house, told through the lives that pass within it.' },
    { id: 'james', title: 'James', author: 'Percival Everett', isbn: '9780385550369', state: 'want', progress: 0, description: 'A radical and compassionate reimagining of an American classic.' },
    { id: 'tomorrow', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', isbn: '9780385547345', state: 'finished', progress: 100, description: 'A novel about friendship, art, play, and the work of making something together.' },
    { id: 'ministry', title: 'The Ministry of Time', author: 'Kaliane Bradley', isbn: '9780593653166', state: 'current', progress: 57, description: 'A time-travel romance, spy thriller, and ingenious exploration of power.' },
    { id: 'martyr', title: 'Martyr!', author: 'Kaveh Akbar', isbn: '9780593537619', state: 'want', progress: 0, description: 'A searching, funny novel about art, faith, death, and the beautiful strangeness of being alive.' },
    { id: 'all-fours', title: 'All Fours', author: 'Miranda July', isbn: '9780593184776', state: 'want', progress: 0, description: 'An irreverent and tender reinvention of the midlife coming-of-age story.' },
    { id: 'orbital', title: 'Orbital', author: 'Samantha Harvey', isbn: '9780802163622', state: 'want', progress: 0, description: 'Six astronauts contemplate Earth and humanity from the intimacy of space.' },
    { id: 'heaven-earth', title: 'The Heaven & Earth Grocery Store', author: 'James McBride', isbn: '9780593422946', state: 'finished', progress: 100, description: 'A compassionate portrait of a community and the secrets it keeps.' },
    { id: 'beautyland', title: 'Beautyland', author: 'Marie-Helene Bertino', isbn: '9780374109288', state: 'dnf', progress: 28, description: 'An otherworldly story about what it means to be human.' },
    { id: 'clear', title: 'Clear', author: 'Carys Davies', isbn: '9781668030660', state: 'want', progress: 0, description: 'A spare, moving story of language, landscape, and connection.' }
  ];

  function createState(saved) {
    const base = { view: 'home', filter: 'all', books: {}, feed: { friends: true, highlights: true, shelf: true }, clubs: {}, lists: {} };
    BOOKS.forEach(book => { base.books[book.id] = { state: book.state, progress: book.progress, rating: 0 }; });
    if (!saved || typeof saved !== 'object') return base;
    const validViews = ['home', 'library', 'discover', 'shop', 'clubs'];
    if (validViews.includes(saved.view)) base.view = saved.view;
    if (['all', 'current', 'want', 'finished', 'dnf'].includes(saved.filter)) base.filter = saved.filter;
    Object.keys(base.books).forEach(id => {
      const item = saved.books && saved.books[id];
      if (!item) return;
      if (['current', 'want', 'finished', 'dnf'].includes(item.state)) base.books[id].state = item.state;
      if (Number.isFinite(Number(item.progress))) base.books[id].progress = Math.max(0, Math.min(100, Number(item.progress)));
      if (Number.isFinite(Number(item.rating))) base.books[id].rating = Math.max(0, Math.min(5, Number(item.rating)));
    });
    if (saved.feed) Object.keys(base.feed).forEach(key => { if (typeof saved.feed[key] === 'boolean') base.feed[key] = saved.feed[key]; });
    ['clubs', 'lists'].forEach(group => {
      if (saved[group] && typeof saved[group] === 'object') Object.keys(saved[group]).forEach(id => { if (typeof saved[group][id] === 'boolean') base[group][id] = saved[group][id]; });
    });
    return base;
  }

  function filterBooks(books, query, filter) {
    const term = String(query || '').trim().toLowerCase();
    return books.filter(book => (filter === 'all' || book.state === filter) && (`${book.title} ${book.author}`.toLowerCase().includes(term)));
  }

  const CATALOG_ENDPOINT = 'https://openlibrary.org/search.json';
  const CATALOG_FIELDS = 'key,title,author_name,cover_i,first_publish_year';

  function buildCatalogSearchUrl(query) {
    const params = new URLSearchParams({ q: String(query || '').trim(), limit: '20', fields: CATALOG_FIELDS });
    return `${CATALOG_ENDPOINT}?${params.toString()}`;
  }

  function normalizeCatalogDocs(docs) {
    if (!Array.isArray(docs)) return [];
    return docs.flatMap(doc => {
      if (!doc || typeof doc.key !== 'string' || !doc.key.trim() || typeof doc.title !== 'string' || !doc.title.trim()) return [];
      const key = doc.key.trim();
      const author = Array.isArray(doc.author_name) && typeof doc.author_name[0] === 'string' && doc.author_name[0].trim() ? doc.author_name[0].trim() : 'Unknown author';
      return [{ id: `ol:${key}`, key, title: doc.title.trim(), author, coverId: Number.isInteger(doc.cover_i) && doc.cover_i > 0 ? doc.cover_i : null, year: Number.isInteger(doc.first_publish_year) && doc.first_publish_year > 0 ? doc.first_publish_year : null, source: 'catalog' }];
    });
  }

  function workFingerprint(book) {
    return `${String(book.title || '').trim().toLowerCase()}\u0000${String(book.author || '').trim().toLowerCase()}`;
  }

  function mergeSearchResults(local, remote) {
    const merged = [];
    const seen = new Set();
    [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])].forEach(book => {
      const fingerprint = workFingerprint(book);
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      merged.push(book);
    });
    return merged;
  }

  const shelfLabel = { current: 'Currently Reading', want: 'Want to Read', finished: 'Finished', dnf: 'Did Not Finish' };

  function getSearchPresentation(options) {
    const query = String(options.query || '').trim();
    const filter = options.filter || 'all';
    const localResults = Array.isArray(options.localResults) ? options.localResults : [];
    const catalogResults = Array.isArray(options.catalogResults) ? options.catalogResults : [];
    const catalogStatus = options.catalogStatus || 'idle';
    const searching = query.length >= 2;
    const catalogEnabled = searching && filter === 'all';
    const results = catalogEnabled ? mergeSearchResults(localResults, catalogResults) : localResults;
    const localNoun = localResults.length === 1 ? 'local match' : 'local matches';
    let countText;
    let statusText = '';
    if (!searching) countText = `${results.length} ${results.length === 1 ? 'book' : 'books'} · preview collection`;
    else if (!catalogEnabled) {
      countText = `${localResults.length} ${localNoun} · ${shelfLabel[filter] || 'Selected'} shelf only`;
      statusText = 'Open Library search is available only in All books.';
    } else if (catalogStatus === 'loading') {
      countText = `${localResults.length} ${localNoun} · searching Open Library…`;
      statusText = `Searching the Open Library catalog for “${query}”…`;
    } else if (catalogStatus === 'error') {
      countText = `${localResults.length} ${localNoun} only`;
      statusText = options.offline ? 'You appear to be offline. Showing matching books from your library.' : 'Catalog search is unavailable. Showing matching books from your library.';
    } else {
      countText = `${results.length} ${results.length === 1 ? 'result' : 'results'} · your library first, then Open Library`;
      if (catalogStatus === 'success' && results.length === 0) statusText = `No library or Open Library results found for “${query}”.`;
    }
    return { results, countText, statusText, emptyVisible: results.length === 0 && catalogStatus !== 'loading' };
  }

  function createCatalogSearchController(options) {
    const settings = options || {};
    const fetchImpl = settings.fetchImpl || root.fetch.bind(root);
    const AbortControllerImpl = settings.AbortControllerImpl || root.AbortController;
    const setTimer = settings.setTimer || root.setTimeout.bind(root);
    const clearTimer = settings.clearTimer || root.clearTimeout.bind(root);
    let timer = null;
    let controller = null;
    let sequence = 0;
    function cancel() {
      sequence += 1;
      if (timer !== null) clearTimer(timer);
      timer = null;
      if (controller) controller.abort();
      controller = null;
    }
    function search(query, notify) {
      cancel();
      const term = String(query || '').trim();
      if (term.length < 2) return;
      const requestSequence = sequence;
      timer = setTimer(async () => {
        timer = null;
        controller = new AbortControllerImpl();
        notify({ status: 'loading', query: term });
        try {
          const response = await fetchImpl(buildCatalogSearchUrl(term), { signal: controller.signal, headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(`Open Library returned ${response.status}`);
          const body = await response.json();
          if (requestSequence !== sequence) return;
          notify({ status: 'success', query: term, results: normalizeCatalogDocs(body && body.docs) });
        } catch (error) {
          if (requestSequence !== sequence || (error && error.name === 'AbortError')) return;
          notify({ status: 'error', query: term, error });
        }
      }, 300);
    }
    return { search, cancel };
  }

  function setBookState(state, id, readingState) {
    const next = JSON.parse(JSON.stringify(state));
    if (next.books[id] && ['current', 'want', 'finished', 'dnf'].includes(readingState)) {
      next.books[id].state = readingState;
      if (readingState === 'finished') next.books[id].progress = 100;
    }
    return next;
  }

  function setBookProgress(state, id, progress) {
    const next = JSON.parse(JSON.stringify(state));
    if (next.books[id]) next.books[id].progress = Math.max(0, Math.min(100, Number(progress) || 0));
    return next;
  }

  function setFeedPreference(state, key, enabled) {
    const next = JSON.parse(JSON.stringify(state));
    if (Object.prototype.hasOwnProperty.call(next.feed, key)) next.feed[key] = Boolean(enabled);
    return next;
  }

  function togglePreference(state, group, id) {
    const next = JSON.parse(JSON.stringify(state));
    if (['clubs', 'lists'].includes(group) && id) next[group][id] = !next[group][id];
    return next;
  }

  const api = { BOOKS, createState, filterBooks, buildCatalogSearchUrl, normalizeCatalogDocs, mergeSearchResults, getSearchPresentation, createCatalogSearchController, setBookState, setBookProgress, setFeedPreference, togglePreference };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root.document) return;

  let state;
  try { state = createState(JSON.parse(root.localStorage.getItem(STORAGE_KEY) || 'null')); } catch (_) { state = createState(); }
  let activeBookId = null;
  let toastTimer;
  let catalogResults = [];
  let catalogStatus = 'idle';
  const doc = root.document;
  const $ = selector => doc.querySelector(selector);
  const $$ = selector => Array.from(doc.querySelectorAll(selector));
  const stateLabel = { current: 'Reading', want: 'Want to Read', finished: 'Finished', dnf: 'Did Not Finish' };

  function save() {
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* local storage can be unavailable */ }
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    root.clearTimeout(toastTimer);
    toastTimer = root.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function coverUrl(book, size) {
    if (book.coverId) return `https://covers.openlibrary.org/b/id/${book.coverId}-${size || 'M'}.jpg`;
    return `https://covers.openlibrary.org/b/isbn/${book.isbn}-${size || 'M'}.jpg`;
  }

  function hydrateBook(book) { return Object.assign({}, book, state.books[book.id]); }

  function createBookCard(book) {
    const article = doc.createElement('article');
    article.className = `book-card${book.source === 'catalog' ? ' catalog-card' : ''}`;
    article.dataset.bookId = book.id;
    const button = doc.createElement('button');
    button.className = 'book-cover';
    button.dataset.openBook = book.id;
    button.setAttribute('aria-label', `Open ${book.title} book details`);
    const img = doc.createElement('img');
    img.src = coverUrl(book);
    img.alt = `${book.title} by ${book.author} cover`;
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.src = `https://placehold.co/320x480/53604f/f5f0e7?text=${encodeURIComponent(book.title)}`; }, { once: true });
    const chip = doc.createElement('span');
    chip.className = `status-chip${book.source === 'catalog' ? ' catalog-chip' : ''}`;
    chip.textContent = book.source === 'catalog' ? 'Open Library catalog' : stateLabel[book.state];
    button.append(img, chip);
    const title = doc.createElement('h3'); title.textContent = book.title;
    const author = doc.createElement('p'); author.textContent = book.author;
    article.append(button, title, author);
    if (book.source === 'catalog') {
      const meta = doc.createElement('p');
      meta.className = 'catalog-meta';
      meta.textContent = book.year ? `First published ${book.year} · Not on your shelf` : 'Catalog result · Not on your shelf';
      article.append(meta);
    }
    return article;
  }

  function renderBooks() {
    const hydrated = BOOKS.map(hydrateBook);
    const row = $('#wantRow');
    row.replaceChildren(...hydrated.filter(book => book.state === 'want').slice(0, 4).map(createBookCard));
    $('#discoverGrid').replaceChildren(...hydrated.slice(1, 6).map(createBookCard));
    const query = $('#searchInput').value;
    const localResults = filterBooks(hydrated, query, state.filter);
    const presentation = getSearchPresentation({ query, filter: state.filter, localResults, catalogResults, catalogStatus, offline: root.navigator && root.navigator.onLine === false });
    const results = presentation.results;
    $('#libraryGrid').replaceChildren(...results.map(createBookCard));
    $('#resultCount').textContent = presentation.countText;
    $('#searchStatus').textContent = presentation.statusText;
    $('#emptyState').hidden = !presentation.emptyVisible;
  }

  function setView(view) {
    if (!['home', 'library', 'discover', 'shop', 'clubs'].includes(view)) return;
    state.view = view;
    $$('.view').forEach(page => page.classList.toggle('active', page.dataset.page === view));
    $$('[data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    save();
    root.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setReadingState(id, readingState) {
    state = setBookState(state, id, readingState);
    save(); renderBooks(); updateHero();
  }

  function updateProgress(id, progress) {
    state = setBookProgress(state, id, progress);
    save(); renderBooks(); updateHero();
  }

  function updateHero() {
    const value = state.books['north-woods'].progress;
    $('#heroPercent').textContent = `${value}%`;
    $('#heroBar').style.width = `${value}%`;
    $('#heroPage').textContent = `Page ${Math.round(372 * value / 100)} of 372`;
  }

  function renderFeed() {
    $$('[data-feed-section]').forEach(section => { section.hidden = !state.feed[section.dataset.feedSection]; });
  }

  function renderPreferences() {
    $$('[data-join-club]').forEach(button => {
      const active = Boolean(state.clubs[button.dataset.joinClub]);
      button.textContent = active ? 'Joined ✓' : 'Join club';
      button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-save-list]').forEach(button => {
      const active = Boolean(state.lists[button.dataset.saveList]);
      button.textContent = active ? 'Saved ✓' : 'Save list';
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function openBook(id) {
    const book = BOOKS.find(item => item.id === id) || catalogResults.find(item => item.id === id);
    if (!book) return;
    const remote = book.source === 'catalog';
    const item = remote ? book : hydrateBook(book);
    activeBookId = id;
    $('#dialogTitle').textContent = item.title;
    $('#dialogAuthor').textContent = item.author;
    $('#dialogDescription').textContent = remote ? `${item.year ? `First published ${item.year}. ` : ''}This is a read-only result from the Open Library catalog and is not on your shelf.` : item.description;
    $('#dialogCover').src = coverUrl(item, 'L');
    $('#dialogCover').alt = `${item.title} by ${item.author} cover`;
    $('#dialogSource').textContent = remote ? 'BOOK DETAILS · OPEN LIBRARY CATALOG' : 'BOOK DETAILS · PREVIEW DATA';
    $('#localBookControls').hidden = remote;
    if (!remote) {
      $('#readingState').value = item.state;
      $('#progressRange').value = item.progress;
      $('#progressOutput').textContent = `${item.progress}%`;
      $$('#ratingButtons button').forEach(button => button.classList.toggle('selected', Number(button.value) <= item.rating));
    }
    $('#bookDialog').showModal();
  }

  function toggleFeedSettings(force) {
    const panel = $('#feedSettings');
    const shouldOpen = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !shouldOpen;
    $('#settingsButton').setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) $('#closeSettings').focus();
  }

  $$('[data-view]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); setView(button.dataset.view); }));
  doc.addEventListener('click', event => {
    const open = event.target.closest('[data-open-book]');
    if (open) openBook(open.dataset.openBook);
    const progress = event.target.closest('[data-progress]');
    if (progress) openBook(progress.dataset.progress);
    const library = event.target.closest('[data-library-filter]');
    if (library) { state.filter = library.dataset.libraryFilter; setView('library'); renderFilters(); renderBooks(); }
    const join = event.target.closest('[data-join-club]');
    if (join) { state = togglePreference(state, 'clubs', join.dataset.joinClub); save(); renderPreferences(); showToast('Club preference saved on this device.'); }
    const list = event.target.closest('[data-save-list]');
    if (list) { state = togglePreference(state, 'lists', list.dataset.saveList); save(); renderPreferences(); showToast('Reading list preference saved on this device.'); }
  });
  function renderFilters() { $$('.filter').forEach(button => { const active = button.dataset.filter === state.filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }); }
  const catalogSearch = createCatalogSearchController();
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    if (state.filter !== 'all') catalogSearch.cancel();
    save(); renderFilters(); renderBooks();
  }));
  $('#searchInput').addEventListener('input', event => {
    if (state.view !== 'library') setView('library');
    const query = event.target.value.trim();
    catalogResults = [];
    catalogStatus = query.length >= 2 && state.filter === 'all' ? 'loading' : 'idle';
    renderBooks();
    if (state.filter !== 'all') { catalogSearch.cancel(); return; }
    catalogSearch.search(query, update => {
      if (update.query !== $('#searchInput').value.trim()) return;
      catalogStatus = update.status;
      if (update.status === 'success') catalogResults = update.results;
      renderBooks();
    });
  });
  $('#readingState').addEventListener('change', event => { setReadingState(activeBookId, event.target.value); const value = state.books[activeBookId].progress; $('#progressRange').value = value; $('#progressOutput').textContent = `${value}%`; showToast(`Moved to ${stateLabel[event.target.value]}.`); });
  $('#progressRange').addEventListener('input', event => { $('#progressOutput').textContent = `${event.target.value}%`; });
  $('#progressRange').addEventListener('change', event => { updateProgress(activeBookId, event.target.value); showToast('Progress updated.'); });
  $$('#ratingButtons button').forEach(button => button.addEventListener('click', () => { state.books[activeBookId].rating = Number(button.value); save(); $$('#ratingButtons button').forEach(item => item.classList.toggle('selected', Number(item.value) <= Number(button.value))); showToast('Rating saved.'); }));
  $('.dialog-close').addEventListener('click', () => $('#bookDialog').close());
  $('#bookDialog').addEventListener('click', event => { if (event.target === $('#bookDialog')) $('#bookDialog').close(); });
  $('#settingsButton').addEventListener('click', () => toggleFeedSettings());
  $('#customizeButton').addEventListener('click', () => toggleFeedSettings(true));
  $('#closeSettings').addEventListener('click', () => toggleFeedSettings(false));
  $$('[data-feed-setting]').forEach(input => { input.checked = state.feed[input.dataset.feedSetting]; input.addEventListener('change', () => { state = setFeedPreference(state, input.dataset.feedSetting, input.checked); save(); renderFeed(); showToast('Feed preference saved.'); }); });

  renderFilters(); renderBooks(); updateHero(); renderFeed(); renderPreferences(); setView(state.view);
  root.setView = setView;
  root.setReadingState = setReadingState;
  root.updateProgress = updateProgress;
  root.toggleFeedSettings = toggleFeedSettings;
})(typeof window !== 'undefined' ? window : globalThis);
