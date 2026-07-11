# Read With Me First Draft Implementation Plan

> **For Hermes:** Build this draft with strict tests-first behavior and independent review before deployment.

**Goal:** Launch a polished, responsive, honest first-draft experience for Read With Me at `readwithme.cc`.

**Architecture:** A dependency-light static SPA using semantic HTML, modern CSS, and vanilla JavaScript. Demo content is local and clearly marked; interactive navigation, filtering, shelf updates, progress, and feed customization persist in localStorage. GitHub Pages hosts the draft, with a custom domain and a mirrored `404.html` fallback.

**Tech Stack:** HTML5, CSS, JavaScript, Node.js built-in test runner, GitHub Pages.

---

### Task 1: Define source-contract tests
- Create `tests/site.test.js` before production UI files.
- Assert the page has the core navigation, hero/feed, library filters, book details, shop actions, clubs/lists, mobile navigation, honest preview labels, custom-domain file, and SPA fallback.
- Run `npm test` and confirm RED because `index.html` does not exist.

### Task 2: Implement the responsive app shell
- Create `index.html`, `styles.css`, and `app.js` with accessible semantic markup.
- Build a warm, literary, image-led design with desktop sidebar and mobile bottom navigation.
- Re-run tests and keep them green.

### Task 3: Add first-draft interactions
- Add view navigation, book search/filtering, reading-state updates, progress controls, rating controls, feed customization, and local persistence.
- Add behavior tests for state helpers before implementation.
- Verify keyboard and pointer interaction.

### Task 4: Add deployment and handoff files
- Create `CNAME`, mirrored `404.html`, `README.md`, `.gitignore`, and package scripts.
- Add deployment and product limitations to README.
- Run tests, JavaScript syntax checks, and a local HTTP smoke test.

### Task 5: Independent review and launch
- Run independent code/security review and correct blockers.
- Commit, create/push the GitHub repository, enable Pages, set custom domain, update DNS if required, and verify HTTPS plus live markers on `readwithme.cc`.
