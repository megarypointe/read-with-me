# Read With Me — first draft

A dependency-free static product preview for a warm, social reading space. It includes a personalized demo feed, a persistent local library, live Open Library search and discovery, shop, clubs, book details, ratings, and reading controls.

## Run locally

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Verify

```sh
npm test
npm run check
```

## Open Library browsing

- Catalog search begins at two characters and requests 20 works per page from Open Library's public `search.json` endpoint.
- **Load more** can retrieve up to five pages (100 raw works). Results are deduplicated across pages by work key and title/author fingerprint.
- Discover loads four bounded shelves in parallel: Reader favorites (fiction sorted by Open Library's `readinglog` signal), Literary fiction, Science fiction, and Biography & memoir. Each requests 10 works.
- Discover shelf results are cached only in memory for the current page session. They are never written to `localStorage`.
- Stale search requests are aborted and sequence-guarded. A failed Discover request degrades only its shelf.
- Remote catalog cards are read-only and transient. They do not alter or masquerade as the user's local library.

## Preview limitations

- People, activity, progress, ratings, and local collections are clearly labeled demo/preview data.
- Local reading changes persist only in `localStorage` in the current browser; there are no accounts or backend.
- Open Library search, discovery, and covers require a network connection. Cover images have fallbacks.
- Discovery shelves are broad catalog paths, not personalized recommendations, exact bestseller rankings, or editorial endorsements.
- Shop uses one generic Bookshop.org search action. No affiliate identifier is configured, and no exact product/edition URL is claimed.
- This repository contains GitHub Pages files (`CNAME` and mirrored `404.html`), but deployment is intentionally outside this implementation.
