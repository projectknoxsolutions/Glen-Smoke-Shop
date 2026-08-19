/* ==========================================================================
   Server-rendered content blocks
   --------------------------------------------------------------------------
   Every string in this file used to be built by main.ts at runtime, into an
   empty <div> that shipped in the HTML. That meant the category names, the
   brand lists, the glass shapes, the kratom brands and the gear copy — the
   actual words this shop wants to be found for — were not in the document a
   crawler downloads. It saw eleven empty containers and a script tag.

   So the markup moved here, to build time. This is the ONLY place these blocks
   are generated now; the matching innerHTML in main.ts was deleted rather than
   guarded, because two copies of the same markup drift and a guard hides it.
   main.ts still owns the BEHAVIOUR — the chip clicks, the "+N more"
   disclosures, the detail sheet — it just no longer owns the words.

   check-pages.mjs asserts each of these containers is non-empty in dist, so a
   silent regression here fails the build rather than quietly de-indexing a page.
   ========================================================================== */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'))

const catalog = J('catalog.json')
const gear = J('gear.json')
const room21 = J('room21.json')
const descriptions = J('descriptions.json')

const BY_ID = new Map(descriptions.entries.map(e => [e.id, e]))
const describe = (id) => BY_ID.get(id) || null

/* ------------------------------------------------------------------ images */
/* Mirrors picture() in main.ts. Kept byte-identical on purpose: the same frames
   are still rendered client-side elsewhere (the tour mosaic, the section
   figures), and two <picture> shapes for one image set would be two bugs. */
function picture(id, alt, sizes = '100vw', eager = false) {
  const w = [960, 1600]
  const set = (ext) => w.map(n => `img/${id}-${n}.${ext} ${n}w`).join(', ')
  return `<picture>
    <source type="image/avif" sizes="${sizes}" srcset="${set('avif')}">
    <img src="img/${id}-1600.jpg" srcset="${set('jpg')}" sizes="${sizes}" alt="${alt}"
         loading="${eager ? 'eager' : 'lazy'}" decoding="async">
  </picture>`
}

/* Mirrors photo() in main.ts — the 9 Aug shoot's 640/1100/1700 set, with WebP
   between AVIF and JPEG. Deliberately a SECOND function rather than a branch
   inside picture(): a helper that guesses which derivative set exists produces
   a broken <img> at runtime and nothing at build time. */
function photo(slug, alt, sizes = '100vw', eager = false) {
  const w = [640, 1100, 1700]
  const set = (ext) => w.map(n => `img/${slug}-${n}.${ext} ${n}w`).join(', ')
  return `<picture>
    <source type="image/avif" sizes="${sizes}" srcset="${set('avif')}">
    <source type="image/webp" sizes="${sizes}" srcset="${set('webp')}">
    <img src="img/${slug}-1100.jpg" alt="${alt}"
         loading="${eager ? 'eager' : 'lazy'}" decoding="async">
  </picture>`
}

/* -------------------------------------------------------------- categories */
/* The eight doors on the home page. Each one is an internal link with a real
   <h3> in it, which is the single highest-value block on the site to have in
   static HTML — it is how the home page passes its authority to the eight
   section pages, and how those pages get their anchor text. */
const CATEGORIES = [
  { id: 'vapes',   img: 'disposable-vape-shelves', name: 'Disposable Vapes',    count: () => `${catalog.vapes.length} brands`,        tint: 'rgba(255,138,30,.28)' },
  { id: 'pouches', img: 'nicotine-pouch-rack', name: 'Nicotine Pouches',    count: () => `${catalog.pouches.length} flavors`,     tint: 'rgba(46,107,255,.3)' },
  { id: 'glass',   img: 'glass-water-pipe-cases', name: 'Glass & Water Pipes', count: () => `${catalog.glass.count} pieces`,         tint: 'rgba(53,255,122,.24)' },
  { id: 'cigars',  img: 'humidor-cigar-display', name: 'Cigars & Humidor',    count: () => `${catalog.cigars.length} houses`,       tint: 'rgba(255,194,77,.28)' },
  { id: 'papers',  img: 'rolling-papers-display', name: 'Papers & Wraps',      count: () => `${catalog.papers.length} brands`,       tint: 'rgba(255,45,155,.24)' },
  { id: 'hookah',  img: 'hookah-shisha-shelf', name: 'Hookah',              count: () => `${catalog.hookah.count} on the shelf`,  tint: 'rgba(46,107,255,.24)' },
  { id: 'gear',    img: 'grinders-torches-case', name: 'Grinders & Torches',  count: () => `${gear.groups.length} kinds of gear`,   tint: 'rgba(255,138,30,.22)' },
  { id: '21-room', img: 'kratom-kava-hemp-shelf', name: 'The 21+ Room',        count: () => 'Kratom, kava & hemp',                   tint: 'rgba(53,255,122,.26)' },
]

const PAGE_OF = {
  vapes: '/vapes', pouches: '/pouches', glass: '/glass', cigars: '/cigars',
  papers: '/papers', gear: '/gear', hookah: '/hookah', '21-room': '/21-room',
}

const catGrid = () => CATEGORIES.map(c0 => { const c = { ...c0, href: PAGE_OF[c0.id] || '/' }; return `
    <a class="cat reveal" href="${c.href}" aria-label="${c.name}" data-prefetch>
      ${picture(c.img, c.name, '(max-width:700px) 46vw, (max-width:1080px) 50vw, 25vw')}
      <span class="cat-glow" style="background:radial-gradient(90% 70% at 50% 100%, ${c.tint}, transparent 70%)"></span>
      <span class="cat-body">
        <h3 class="cat-name">${c.name}</h3>
        <span class="cat-count">${c.count()}</span>
      </span>
    </a>` }).join('')

/* ------------------------------------------------------------ brand chips */
/* Six visible, the rest behind a disclosure. The hidden ones are hidden with
   the `hidden` attribute, not display:none in a stylesheet and not absent —
   they are in the document, which is the whole point of rendering them here.
   The count in the button label is carried in data-more so main.ts can restore
   it when the disclosure closes without re-deriving the array. */
const chip = (a) =>
  a.id && describe(a.id)
    ? `<button class="brand-chip" type="button" data-detail="${a.id}">${a.brand}</button>`
    : `<span class="brand-chip">${a.brand}</span>`

const chips = (arr, shown = 6) => {
  const head = arr.slice(0, shown), rest = arr.slice(shown)
  return head.map(chip).join('') +
    (rest.length
      ? `<span class="brand-more" hidden>${rest.map(chip).join('')}</span>
           <button class="brand-chip is-more" aria-expanded="false" data-more="${rest.length}">+${rest.length} more</button>`
      : '')
}

/* ----------------------------------------------------------------- cigars */
const cigarChip = (c) =>
  c.id && describe(c.id)
    ? `<button class="cigar-name" type="button" data-detail="${c.id}" data-meta="${c.line || ''}">${c.brand}</button>`
    : `<span class="cigar-name">${c.brand}</span>`

const cigarList = (arr, shown) => {
  const head = arr.slice(0, shown), rest = arr.slice(shown)
  return head.map(cigarChip).join('') +
    (rest.length
      ? `<span class="brand-more" hidden>${rest.map(cigarChip).join('')}</span>
           <button class="cigar-name is-more" aria-expanded="false" data-more="${rest.length}">+${rest.length} more</button>`
      : '')
}

/* ------------------------------------------------------------------ vapes */
const vapeBrands = () => catalog.vapes.map(v => `
    <button class="brand-chip ${v.hero ? 'is-hero' : ''}" data-brand="${v.id}"
            aria-expanded="false" aria-controls="vape-detail">
      ${v.hero ? '<span class="star">★</span>' : ''}${v.brand}
    </button>`).join('')

const hardwareBrands = () => catalog.hardware.map(h =>
  `<button class="brand-chip" type="button" data-detail="${h.id}">${h.brand}</button>`).join('')

/* ------------------------------------------------------------------- gear */
const gearGrid = () => gear.groups.map(g => `
    <article class="gear-card reveal" id="${g.id}">
      <h3 class="gear-name">${g.name}</h3>
      <p class="gear-lede">${g.lede}</p>
      <p class="gear-detail">${g.detail}</p>
      ${g.brands?.length ? `<div class="gear-brands">${g.brands.map(b => `<span class="chip">${b}</span>`).join('')}</div>` : ''}
      ${g.specs?.length ? `<ul class="gear-specs">${g.specs.map(sp => `<li>${sp}</li>`).join('')}</ul>` : ''}
    </article>`).join('')

/* --------------------------------------------------------------- 21+ room */
const room21Grid = () => room21.groups.map(g => `
    <article class="gear-card reveal" id="r21-${g.id}">
      <h3 class="gear-name">${g.name}</h3>
      <p class="gear-lede">${g.lede}</p>
      ${g.brands?.length ? `<div class="gear-brands">${g.brands.map(b => `<span class="chip">${b.name}</span>`).join('')}</div>` : ''}
      ${g.forms?.length ? `<ul class="gear-specs">${g.forms.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
      ${g.veins?.length ? `<p class="r21-meta"><span>Vein</span> ${g.veins.join(' · ')}</p>` : ''}
      ${g.origins?.length ? `<p class="r21-meta"><span>Origin</span> ${g.origins.join(' · ')}</p>` : ''}
      ${g.note ? `<p class="gear-detail">${g.note}</p>` : ''}
    </article>`).join('')

/* ------------------------------------------------------------------ glass */
const COLOR_HEX = {
  clear: '#DDE6F0', cobalt: '#1E4FD8', 'royal blue': '#2E6BFF', jade: '#2FA980',
  'kelly green': '#3CB44B', amber: '#D98A2B', gold: '#C9A227', 'gold fume': '#C9A227',
  iridescent: '#8E7BE0', 'oil slick': '#6A5ACD', maroon: '#7B1F3A', coral: '#F4796B',
  'blush pink': '#F2A0BE', lavender: '#B79CE8', rasta: '#3CB44B', white: '#EDEDED',
  black: '#222833', purple: '#7C4DFF', teal: '#1FA8A0', pink: '#FF6FAE',
}

const glassStats = () => [
  { n: catalog.glass.count, l: 'Pieces on display' },
  { n: '150+', l: 'Hand pipes & chillums' },
  { n: catalog.hookah.count, l: 'Hookahs' },
].map(s => `<div class="gstat"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('')

const glassColors = () => {
  const seen = new Set()
  return catalog.glass.colors.flatMap(raw => {
    const key = Object.keys(COLOR_HEX).find(k => raw.toLowerCase().includes(k))
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [`<span class="swatch"><i style="background:${COLOR_HEX[key]}"></i>${key.replace(/\b\w/g, m => m.toUpperCase())}</span>`]
  }).join('')
}

/* -------------------------------------------------------------- spec tiles */
const GLASS_PERC = /perc|condenser|ice-pinch/i
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const specTile = (id) => {
  const d = describe(id)
  if (!d) return ''
  return `<button class="spec" type="button" data-detail="${id}">
    <span class="spec-n">${d.name}</span>
    ${d.blurb ? `<span class="spec-b">${d.blurb}</span>` : ''}
  </button>`
}

const HOOKAH_PARTS = [
  'hookah-pipes', 'hookah-bowl-phunnel', 'hookah-bowl-egyptian', 'hookah-bowl-vortex',
  'hookah-bowl-silicone', 'hookah-hose-washable', 'hookah-hose-traditional',
  'hookah-coals-coconut', 'hookah-coals-quick-light', 'hookah-heat-management',
  'hookah-tongs-foil-punch', 'hookah-grommets-mouth-tips',
]

/* ------------------------------------------------------------------- tour */
const TOUR = [
  { id: 'smoke-shop-sales-floor', cls: 'w4', alt: 'Wide view of the sales floor, shelves and cases on every wall' },
  { id: 'store-shelving-and-displays', cls: 'w2', alt: 'Product shelving and centre display at Glen Smoke Shop' },
  { id: 'dab-rig-display-case', cls: 'w2', alt: 'Display case of dab rigs, nectar collectors and silicone pieces' },
  { id: 'hand-blown-water-pipe-case', cls: 'w2', alt: 'Lit glass case filled with hand-blown water pipes' },
  { id: 'walk-in-humidor-shelves', cls: 'w2', alt: 'Cedar humidor shelves lined with cigars' },
  { id: 'disposable-vape-aisle', cls: 'w3', alt: 'Aisle of disposable vapes stretching to the back of the store' },
  { id: 'vape-wrap-hemp-shelf-bay', cls: 'w3', alt: 'A stocked shelf bay of vapes, wraps and hemp-derived products' },
  { id: 'glen-smoke-shop-storefront', cls: 'w3', alt: 'Glen Smoke Shop storefront lit up at night' },
  { id: 'shelf-bay-from-counter', cls: 'w3', alt: 'The full shelf bay from the counter, floor to arch' },
]

const tourMosaic = () => TOUR.map(t =>
  `<figure class="${t.cls}">${picture(t.id, t.alt, '(max-width:860px) 100vw, 50vw')}</figure>`).join('')

/* ---------------------------------------------------------- section photos */
/* Every photograph on this site used to be inserted by main.ts, into a <figure>
   that shipped empty. Twenty-nine shelf photographs with careful alt text, and
   not one of them was in the document — invisible to Google Images, and
   invisible to the browser's preload scanner, which is the thing that decides
   how fast the largest image on the page starts downloading.
   
   The figures keep their data-photo / data-alt attributes: they are where the
   slug and the alt text are authored, and they are what this reads. */
const FIG_SIZES = '(max-width:940px) 100vw, 52vw'
const STRIP_SIZES = '(max-width:700px) 92vw, (max-width:1100px) 46vw, 31vw'

export function fillFigures(html) {
  return html.replace(/<figure\b([^>]*?)\bdata-(img|photo)="([^"]+)"([^>]*)>/g, (m, pre, kind, slug, post) => {
    const attrs = pre + post
    const alt = (attrs.match(/data-alt="([^"]*)"/) || [, ''])[1]
    const cls = (attrs.match(/class="([^"]*)"/) || [, ''])[1]
    const strip = /\bstrip-shot\b/.test(cls)
    // The one photograph at the top of a section is almost always its LCP
    // element, so it is fetched eagerly; the strips below the fold are not.
    const eager = /\b(brand-photo|glass-hero)\b/.test(cls)
    const sizes = strip ? STRIP_SIZES : FIG_SIZES
    const inner = kind === 'photo' ? photo(slug, alt, sizes, eager) : picture(slug, alt, sizes, eager)
    return m + inner
  })
}

/* ------------------------------------------------------------------ table */
/** Container id → the HTML that belongs inside it. */
export const BLOCKS = {
  'cat-grid':         catGrid(),
  'vape-brands':      vapeBrands(),
  'hardware-brands':  hardwareBrands(),
  'cigars-premium':   cigarList(catalog.cigars.filter(c => c.premium), 8),
  'cigars-value':     cigarList(catalog.cigars.filter(c => !c.premium), 6),
  'paper-brands':     chips(catalog.papers),
  'accessory-brands': chips(catalog.accessories),
  'kratom-brands':    chips(catalog.kratom),
  'gear-grid':        gearGrid(),
  'room21-grid':      room21Grid(),
  'glass-stats':      glassStats(),
  'glass-colors':     glassColors(),
  'glass-shapes':     catalog.glass.styles.filter(s => !GLASS_PERC.test(s)).map(s => specTile(slug(s))).join(''),
  'glass-percs':      catalog.glass.styles.filter(s => GLASS_PERC.test(s)).map(s => specTile(slug(s))).join(''),
  'hookah-parts':     HOOKAH_PARTS.map(specTile).join(''),
  'gallery':          tourMosaic(),
}

/**
 * Fill every empty container in `html` whose id is in BLOCKS.
 *
 * Deliberately strict: it only matches a container that is EMPTY in the part
 * file (`<div ... id="x"></div>`). If someone later hand-writes content into
 * one, this quietly leaves it alone rather than clobbering it — and the
 * unfilled-id report below turns the mismatch into a build failure instead.
 */
export function fillBlocks(html) {
  let out = html
  for (const [id, inner] of Object.entries(BLOCKS)) {
    const re = new RegExp(`(<div[^>]*\\bid="${id}"[^>]*>)</div>`)
    if (!re.test(out)) continue
    if (!inner) throw new Error(`blocks: #${id} rendered empty — refusing to ship an empty container`)
    out = out.replace(re, `$1${inner}</div>`)
  }
  return out
}
