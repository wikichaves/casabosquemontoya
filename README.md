# Casa Bosque Montoya

Landing page for **Casa Bosque Montoya** — four low-density vacation homes among pines and sea, in Montoya, La Barra (Maldonado, Uruguay). Opening December 2026.

🌐 **Production:** https://casabosquemontoya.com

## Stack

A **static** site, no build step. Everything lives in a single `index.html` (inline HTML + CSS + JS).

- Vanilla HTML/CSS/JS — no frameworks or runtime dependencies
- Typography via Google Fonts: Instrument Serif, JetBrains Mono, Geist
- Bilingual ES/EN with a homegrown JS i18n (no libraries)
- Hosted on **Vercel** (static, `framework: null`) + Vercel Web Analytics

> The project started on Next.js and was simplified to static HTML/CSS/JS. If you see `.next/` or `node_modules/` locally, they're leftovers ignored by git.

## Structure

```
index.html        The entire page (markup + styles + scripts)
assets/           Site images (renders, logo, favicon, OG)
vercel.json       Vercel config (pure static)

.claude/          Local tooling config (launch.json for preview)
```

`_archive/` and `_downloads/` are ignored by git.

## Images

Each render ships as a `.jpeg` (the `<picture>` fallback, also what the lightbox
falls back to) plus WebP variants at 800px, 1600px and full width. The gallery
picks a variant via `srcset`/`sizes`; the lightbox always loads the full-width
WebP from the tile's `data-full`.

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

The OG image (`cabin-kids-og.jpeg`) stays jpeg — some social scrapers still
don't handle WebP.

## Local development

Since it's static, just serve the folder:

```bash
python3 -m http.server 4321
# then open http://localhost:4321
```

(There's a `.claude/launch.json` with that same server for the integrated preview.)

You can also open `index.html` directly in the browser, though serving it over HTTP is closer to production.

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
