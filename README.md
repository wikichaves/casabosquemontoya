# Casa Bosque Montoya

Landing page for **Casa Bosque Montoya** — four low-density vacation homes among pines and sea, in Montoya, La Barra (Maldonado, Uruguay). Opening December 2026.

🌐 **Production:** https://casabosquemontoya.com

## Stack

A **static** site, no build step. Everything lives in a single `index.html` (inline HTML + CSS + JS).

- Vanilla HTML/CSS/JS — no frameworks or runtime dependencies
- Typography self-hosted from `assets/fonts/`: Instrument Serif, JetBrains Mono, Geist
- Bilingual ES/EN with a homegrown JS i18n (no libraries)
- Hosted on **Vercel** (static, `framework: null`) + Vercel Web Analytics

> The project started on Next.js and was simplified to static HTML/CSS/JS. If you see `.next/` or `node_modules/` locally, they're leftovers ignored by git.

## Structure

```
index.html        The entire page (markup + styles + scripts)
assets/           Site images (renders, logo, favicon, OG)
assets/fonts/     Self-hosted woff2 subsets + OFL license
robots.txt        Crawl policy + sitemap pointer
sitemap.xml       One entry; bump <lastmod> when content changes
vercel.json       Vercel config (pure static)

.claude/          Local tooling config (launch.json for preview)
```

`_archive/` and `_downloads/` are ignored by git.

## Images

Each render ships as a `.jpeg` fallback plus WebP variants at 800px and full
width (and 1600px when the source is large enough). The gallery picks a variant
via `srcset`/`sizes`; the lightbox loads the full-width WebP from the tile's
`data-full`.

**If you add or replace a render, regenerate its variants** — otherwise the
`srcset` points at files that don't exist and only the jpeg fallback is served:

```bash
brew install webp   # once
cd assets
f=my-render         # name without extension
w=$(sips -g pixelWidth "$f.jpeg" | awk '/pixelWidth/{print $2}')
cwebp -q 80 -m 6 "$f.jpeg" -o "$f.webp"
for t in 800 1600; do [ "$w" -gt "$t" ] && cwebp -q 80 -m 6 -resize $t 0 "$f.jpeg" -o "$f-$t.webp"; done
```

The OG image stays jpeg — some social scrapers still don't handle WebP.

The hero is a CSS background, not an `<img>`, so it can't use `srcset`. It
switches through `image-set()` plus the `max-width:900px` breakpoint:
desktop gets the horizontal exterior render and phones get the vertical Type 2
render with its path and garden. **The two
`rel=preload` tags in `<head>` carry matching `media` attributes; if you move
that breakpoint, move it in all three places** or phones will preload the wide
file on top of the crop.

## Local development

Start the local preview with automatic browser refresh (no extra dependencies):

```bash
npm run dev
# or: python3 scripts/dev_server.py
# then open http://localhost:4321
```

HTML, styles, scripts and asset changes refresh the page automatically. The preview
preserves your scroll position and disables browser caching. The refresh script is
injected only by the local server; production files stay static. This server previews
the static site; the `/api/contacto` function still requires a Vercel environment.

(There's a `.claude/launch.json` with that same server for the integrated preview.)

You can also open `index.html` directly in the browser, though serving it over HTTP is closer to production.

## Fonts

Self-hosted in `assets/fonts/` as woff2, latin + latin-ext subsets, with the
`@font-face` rules inline at the top of the `<style>` block. All three families
are SIL OFL 1.1 — see `assets/fonts/OFL.txt`.

Only the faces the CSS actually asks for are bundled: Instrument Serif 400
roman + italic, JetBrains Mono 400, Geist 300 + 400 — five files, 118 KB.
**Adding a `font-weight` the bundle doesn't cover makes the browser synthesize
it**, which looks noticeably worse than the real face. That's why the selected
language-menu item is distinguished by colour rather than weight. To add a real
weight instead:

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -A "$UA" "https://fonts.googleapis.com/css2?family=Geist:wght@600&display=swap"
```

That returns `@font-face` blocks per subset; keep the `latin` and `latin-ext`
ones, download their woff2 into `assets/fonts/`, and paste the rules in with
the `src` rewritten to the local path.

The three faces the hero needs are `rel=preload`ed in `<head>`. Font preloads
need `crossorigin` even same-origin — without it the file is fetched twice.

## Editing content

The site is **bilingual (ES / EN)** and Spanish is the default HTML content (no-JS fallback). English is applied on top via JS.

**To change a translatable text you must edit it in TWO places:**

1. The HTML markup — this is the Spanish text (default) and carries an attribute:
   - `data-i18n="key"` → replaces `textContent`
   - `data-i18n-html="key"` → replaces `innerHTML` (when it contains `<em>`, `<br>`, etc.)
   - `data-i18n-attr="alt:key"` → replaces an attribute (alt, aria-label…)
2. The `T` dictionary inside the `<script>` — `es` **and** `en` entries for that same `key`.

If a key exists in the HTML but is missing from the dictionary, that text won't translate when switching languages. Keep both sides in sync.

Fixed text (proper nouns: Montoya, La Barra, José Ignacio, etc.) is marked with `translate="no"` and excluded from i18n.

Language selector behavior:
- Initial language: `localStorage['cbm-lang']` › `navigator.language` › `es`
- The choice is persisted in `localStorage`
- Updates `<html lang>` on every switch

## Deploy

Push to `main` → Vercel deploys automatically. There's no build step.

`vercel.json` sets `Cache-Control` on static assets — without it Vercel serves
everything as `max-age=0, must-revalidate`, so every repeat visit re-validates
each file. Fonts get a year and `immutable`; images get a week.

**Images get a week rather than a year because their filenames carry no content
hash.** Replace an existing render and returning visitors keep the old bytes
until the week is up. If you need a render swapped immediately, ship it under a
new revisioned filename. `index.html`, `robots.txt` and `sitemap.xml`
deliberately keep the default and revalidate every time, which is what makes a
deploy visible at once.


## Checks before release

Run `npm ci --ignore-scripts` and `npm test` to exercise contact validation and both confirmation languages without sending email. `npm audit --omit=dev` checks the locked dependency tree.

`.vercelignore` excludes unused image drafts, source references and local development tooling from public deployments. When changing image filenames, update this list so active assets are included.

The current English translation is client-side on the same URL. A future SEO improvement is a separately served English URL with reciprocal `hreflang`; do not add language alternates until those pages exist.
