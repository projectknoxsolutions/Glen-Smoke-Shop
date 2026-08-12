import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Nine real pages, not a router. Each section is its own indexable URL with its
// own title, description and breadcrumbs — for a local business that is worth
// far more than a slicker transition. They share one CSS and one JS bundle, so
// after the first view every other page is a cached-asset paint.
// MUST stay in step with SECTIONS in scripts/build-pages.mjs. Adding a section
// there without adding it here produces a page that exists at the repo root,
// passes every content check, and is simply never emitted into dist — so the
// dev preview falls back to index and the page looks like it "works" until you
// notice it is the home page wearing the right <title>.
const PAGES = ['index', 'vapes', 'pouches', 'glass', 'cigars', 'papers', 'gear', 'hookah', 'hemp', 'visit']

export default defineConfig({
  // Relative base so one build works both at the GitHub Pages project sub-path
  // (/Glen-Smoke-Shop/) and later at a bare domain root on Cloudflare.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    cssCodeSplit: false,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map(p => [p, resolve(import.meta.dirname, `${p}.html`)])),
    },
  },
})
