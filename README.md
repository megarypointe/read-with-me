# Read With Me — first draft

A dependency-free static product preview for a warm, social reading space. It includes a personalized feed, searchable library, discovery, shop, clubs, book details, ratings, reading-state and progress controls, and browser-local persistence.

## Run locally

Use any static server, for example:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Verify

```sh
npm test
npm run check
```

## Preview limitations

- People, activity, progress, ratings, and collections are clearly labeled demo/preview data.
- Changes persist only in `localStorage` in the current browser; there are no accounts or backend.
- Covers are loaded from Open Library with image fallbacks.
- Shop links open Bookshop.org. They are disclosed affiliate links.
- This repository contains GitHub Pages files (`CNAME` and mirrored `404.html`), but deployment is intentionally outside this implementation.
