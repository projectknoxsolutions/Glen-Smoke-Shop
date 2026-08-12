/* ==========================================================================
   Compose the static pages.

   The site used to be one 14,000px scroll. It is now nine real HTML pages that
   share a shell. This is deliberately NOT a client-side router:

   - Every section becomes an indexable URL with its own title, description and
     structured data. For a local business that is the whole game — "vape shop
     glen ellyn" and "cigar humidor glen ellyn" are different searches and now
     they have different landing pages.
   - Deep links work from cold on GitHub Pages with no 404.html trickery, and
     keep working when the site moves to a domain root, because `base` is './'.
   - There is no route state to desync. The age gate lives in localStorage, so
     it does not re-fire on internal navigation.

   Navigation still feels instant: links prefetch on hover and touchstart, and
   every page shares one CSS and one JS bundle that is already in cache after
   the first view.

   Run before `vite build` (see the build script in package.json).
   ========================================================================== */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const P = (f) => fs.readFileSync(path.join(ROOT, 'src/pages/parts', f), 'utf8')

const part = {
  head: P('_head.html'),
  premain: P('_premain.html'),
  postmain: P('_postmain.html'),
  hero: P('hero.html'),
  ticker: P('ticker.html'),
  shop: P('shop.html'),
  vapes: P('vapes.html'),
  pouches: P('pouches.html'),
  glass: P('glass.html'),
  cigars: P('cigars.html'),
  papers: P('papers.html'),
  gear: P('gear.html'),
  notfound: P('notfound.html'),
  room21: P('room21.html'),
  shopindex: P('shopindex.html'),
  hookah: P('hookah.html'),
  tour: P('tour.html'),
  reviews: P('reviews.html'),
  visit: P('visit.html'),
}

// The canonical home of this site. Everything indexable — canonical links,
// og:url, og:image, the LocalBusiness JSON-LD, the sitemap — is built from
// this one string, so moving hosts is a one-line change rather than a hunt
// through nine generated files.
//
// LEGACY_ORIGINS exists because those URLs also appear as literals inside
// src/pages/parts/_head.html, and only some of them are rewritten field by
// field below. og:image and the JSON-LD @id were not, and would have kept
// pointing at the old project sub-path after the move — declaring one
// canonical host while advertising another is exactly how a small business
// ends up with Google indexing the wrong address. The sweep in compose()
// catches every one of them, wherever it appears.
const SITE = 'https://glensmokeshop.com'

const LEGACY_ORIGINS = [
  'https://projectknoxsolutions.github.io/Glen-Smoke-Shop',
]

/** The public URL path for a section, WITHOUT the .html extension.

    Cloudflare Pages serves every page at its extensionless path and issues a
    308 from the .html form — /cigars.html permanently redirects to /cigars.
    Linking with the extension therefore made every nav click, every tile, every
    breadcrumb and every sitemap entry a redirect: an extra round trip for the
    visitor, and a sitemap full of URLs that are not the ones Google will index.

    The files on disk keep their .html names — Vite's rollupOptions.input needs
    real filenames, and Pages maps /cigars onto cigars.html itself. Only what we
    ADVERTISE changes. */
const pathFor = (slug) => (slug === 'index' ? '/' : `/${slug}`)

/** The eight doors, in the order they appear on the hub. */
export const SECTIONS = [
  {
    slug: 'vapes', nav: 'Vapes', tile: 'Disposables & vapes',
    title: 'Vape Shop in Glen Ellyn, IL — Disposables, Geek Bar & North',
    desc: 'A floor-to-ceiling disposable wall at Glen Smoke Shop, 944 Roosevelt Rd. Geek Bar, North, Lost Mary, Breeze, RAZ and more, plus hardware and mods.',
    kicker: '01 — Disposables',
    lede: 'Floor to ceiling, restocked constantly.',
    img: 'IMG_6092', parts: ['vapes'],
  },
  {
    slug: 'pouches', nav: 'Pouches', tile: 'Nicotine pouches',
    title: 'ZYN & Nicotine Pouches in Glen Ellyn, IL — Glen Smoke Shop',
    desc: 'Three full cabinets of nicotine pouches at 944 Roosevelt Rd, Glen Ellyn: ZYN, ZYN Ultra, VELO, sesh+, ZIMO and more. Filter by brand and strength.',
    kicker: '02 — Nicotine pouches',
    lede: 'Three full cabinets, every flavour photographed off our own shelf.',
    img: 'IMG_6083', parts: ['pouches'],
  },
  {
    slug: 'glass', nav: 'Glass', tile: 'Glass & water pipes',
    title: 'Hand-Blown Glass & Water Pipes — Glen Ellyn, IL',
    desc: 'Lit cases of hand-blown glass at Glen Smoke Shop, Glen Ellyn: water pipes, rigs, hand pipes, bubblers and accessories from working glassblowers.',
    kicker: '03 — Glass',
    lede: 'Lit cases, front to back.',
    img: 'IMG_6077', parts: ['glass'],
  },
  {
    slug: 'cigars', nav: 'Cigars', tile: 'The walk-in humidor',
    title: 'Cigar Humidor in Glen Ellyn, IL — 30 Houses at Glen Smoke Shop',
    desc: 'A real walk-in cedar humidor at 944 Roosevelt Rd, Glen Ellyn, holding thirty cigar houses from everyday sticks to premium boxes.',
    kicker: '04 — The humidor',
    lede: 'A real cedar room, not a case by the register.',
    img: 'IMG_6089', parts: ['cigars'],
  },
  {
    slug: 'papers', nav: 'Papers', tile: 'Papers, wraps & gear',
    title: 'Rolling Papers, Wraps & Smoking Accessories — Glen Ellyn, IL',
    desc: 'RAW, Elements, Zig-Zag, Juicy Jay and more at Glen Smoke Shop, Glen Ellyn — papers, wraps, cones, grinders, trays and everyday gear.',
    kicker: '05 — Papers, wraps & gear',
    lede: 'Every size, every material, and the gear that goes with it.',
    img: 'IMG_6084', parts: ['papers'],
  },
  {
    // Its own page at last. See src/pages/parts/gear.html for why it never
    // had one, and src/data/gear.json for where the content comes from.
    slug: 'gear', nav: 'Gear', tile: 'Grinders, torches & gear',
    title: 'Grinders, Torches, Lighters & Scales — Glen Ellyn, IL',
    desc: 'Grinders, torch lighters, BIC and Clipper, digital scales, glass and silicone storage, trays and tools at Glen Smoke Shop, 944 Roosevelt Rd, Glen Ellyn.',
    kicker: '06 — Grinders, torches & gear',
    lede: 'Two shelves of grinders, and a case built around jet flame.',
    img: 'IMG_6181', parts: ['gear'],
  },
  {
    slug: 'hookah', nav: 'Hookah', tile: 'Hookah & botanicals',
    title: 'Hookah, Shisha & Botanicals — Glen Smoke Shop, Glen Ellyn IL',
    desc: 'Hookahs, bowls, hoses, coals and heat management at 944 Roosevelt Rd, Glen Ellyn, alongside our botanical shelf.',
    kicker: '07 — Hookah & botanicals',
    lede: 'Bowls, hoses, coals and heat management.',
    img: 'IMG_6074', parts: ['hookah'],
  },
  {
    // Was 'hemp'. The old slug 301s here — see public/_redirects.
    slug: '21-room', nav: '21+ Room', tile: 'Behind the counter',
    title: 'Kratom, Kava & Hemp — The 21+ Room at Glen Smoke Shop, Glen Ellyn IL',
    desc: 'Kratom, kava, botanicals and the hemp-derived shelf at Glen Smoke Shop, 944 Roosevelt Rd, Glen Ellyn. Brands and forms only. You must be 21 or older; we card everyone, every time.',
    kicker: '08 — Behind the counter',
    lede: 'Kept behind the counter, and we card for it.',
    img: 'IMG_6081', parts: ['room21'],
  },
  {
    slug: 'visit', nav: 'Visit', tile: 'Visit the shop',
    title: 'Visit Glen Smoke Shop — 944 Roosevelt Rd, Glen Ellyn, IL',
    desc: 'Hours, directions, phone and text for Glen Smoke Shop at 944 Roosevelt Rd, Glen Ellyn, Illinois. Call or text (331) 551-0005.',
    kicker: '09 — Visit',
    lede: 'Where we are, when we are open, and how to reach us.',
    img: 'IMG_6070', parts: ['visit', 'tour', 'reviews'],
  },
]

/* -------------------------------------------------------------- helpers -- */

const navHtml = (current) => `
  <div class="nav-links">
    ${SECTIONS.filter(s => s.slug !== 'visit').map(s =>
      `<a href="${pathFor(s.slug)}"${s.slug === current ? ' aria-current="page"' : ''} data-prefetch>${s.nav}</a>`
    ).join('\n    ')}
    <a href="${pathFor('visit')}"${current === 'visit' ? ' aria-current="page"' : ''} data-prefetch>Visit</a>
    <a href="/shop"${current === 'shop' ? ' aria-current="page"' : ''} data-prefetch>All brands</a>
  </div>`

/** The strip of other doors that closes every section page. */
const moreDoors = (current) => `
<section class="section more-doors">
  <div class="wrap">
    <p class="sec-kicker">More of the shop</p>
    <div class="door-strip">
      ${SECTIONS.filter(s => s.slug !== current).map(s =>
        `<a class="door-chip" href="${pathFor(s.slug)}" data-prefetch>${s.tile}</a>`).join('\n      ')}
      ${current === 'shop' ? '' : '<a class="door-chip door-chip-all" href="/shop" data-prefetch>Every brand we carry</a>'}
    </div>
  </div>
</section>`

/** Compact masthead for a section page — the storefront, one line of type. */
const sectionHead = (s) => `
<header class="pagehead" id="top">
  <div class="pagehead-media" aria-hidden="true">
    <picture>
      <source type="image/avif" sizes="100vw"
        srcset="img/hero-wide-1600.avif 1600w, img/hero-wide-2200.avif 2200w, img/hero-wide-3000.avif 3000w">
      <img src="img/hero-wide-1600.jpg" alt="" decoding="async" fetchpriority="high">
    </picture>
  </div>
  <div class="pagehead-sign" aria-hidden="true">
    <picture>
      <source type="image/avif" sizes="100vw"
        srcset="img/hero-wide-1600.avif 1600w, img/hero-wide-2200.avif 2200w, img/hero-wide-3000.avif 3000w">
      <img src="img/hero-wide-1600.jpg" alt="" decoding="async">
    </picture>
  </div>
  <div class="pagehead-scrim" aria-hidden="true"></div>
  <div class="wrap pagehead-body">
    <a class="backlink" href="/" data-prefetch>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
      All sections
    </a>
    <p class="sec-kicker">${s.kicker}</p>
    <h1 class="pagehead-title">${s.tile}</h1>
    <p class="pagehead-lede">${s.lede}</p>
  </div>
</header>`

const breadcrumbs = (s) => `
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
 {"@type":"ListItem","position":1,"name":"Glen Smoke Shop","item":"${SITE}/"},
 {"@type":"ListItem","position":2,"name":${JSON.stringify(s.tile)},"item":"${SITE}${pathFor(s.slug)}"}]}
</script>`

/* The star rating Google can actually read.

   Before this, reviews.json carried an `aggregate` block that NOTHING read,
   and no page emitted aggregateRating at all — so the listing was never
   eligible for a star rating in search. Updating the number in reviews.json
   felt like maintenance and did nothing.

   Substituted at build time rather than written into _head.html as a literal,
   because a literal is how it became dead data the first time. */
const REVIEWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/reviews.json'), 'utf8'))
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'))

/** Rewrite the shared <head> for one page. */
function headFor({ title, desc, url, extra = '' }) {
  /* __RATING__ / __REVIEWS__ are substituted document-wide in compose(), not
     here: the visible score in reviews.html is in the BODY, and while this
     replace only touched the head it drifted to a stale 4.2 literal while the
     schema said 4.3. One source, one substitution, every occurrence. */
  let h = part.head
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
  h = h.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${desc}$2`)
  h = h.replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${url}$2`)
  h = h.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${title}$2`)
  h = h.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${desc}$2`)
  h = h.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${url}$2`)
  return h.replace('</head>', `${extra}\n</head>`)
}

/* ItemList per section page.

   Tells Google the page is an index of a category rather than an article about
   one, which is what a category page competing for "vape shop glen ellyn"
   actually is. Deliberately NO Product entries and NO Offer: nothing is sold
   online, and an Offer without a price is either a lie or an invitation for
   Google to invent one. The list names what the shop stocks; the shop sells it
   in person.

   Counts come from catalog.json so the numbers cannot drift from the page. */
function itemListFor(s) {
  const buckets = {
    vapes: (c) => c.vapes.map(v => v.brand),
    pouches: (c) => c.pouch_brands,
    cigars: (c) => c.cigars.map(v => v.brand),
    papers: (c) => c.papers.map(v => v.brand),
    gear: () => ['Grinders', 'Torch lighters', 'Everyday lighters', 'Digital scales',
                 'Storage & stash', 'Metal pipes & one-hitters', 'Trays & tools'],
    // glass has no brand list — the pieces are one-off hand-blown, so the
    // meaningful index is the STYLES the shop stocks, which is also what
    // someone searching "recycler glen ellyn" is actually looking for.
    glass: (c) => c.glass.styles,
  }
  const pick = buckets[s.slug]
  if (!pick) return ''
  let names = []
  try { names = [...new Set(pick(CATALOG))].filter(Boolean) } catch { return '' }
  if (!names.length) return ''
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: s.tile,
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: names.length,
    itemListElement: names.map((n, i) => ({
      '@type': 'ListItem', position: i + 1, name: n,
    })),
  }
  return `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`
}

function compose({ slug, head, body, current }) {
  const premain = part.premain.replace(/<div class="nav-links">[\s\S]*?<\/div>/, navHtml(current).trim())
  let out = [head, premain, '<main id="main" class="shell">', body, part.postmain].join('\n')
  out = out.split('__RATING__').join(String(REVIEWS.aggregate.rating))
  out = out.split('__REVIEWS__').join(String(REVIEWS.aggregate.count))
  // Last thing before the file is written: no absolute URL may name an origin
  // this site does not live at. See the note on LEGACY_ORIGINS.
  for (const origin of LEGACY_ORIGINS) out = out.split(origin).join(SITE)
  fs.writeFileSync(path.join(ROOT, slug === 'index' ? 'index.html' : `${slug}.html`), out)
  return out.length
}

/* ------------------------------------------------------------------ hub -- */

const hubBody = [
  part.hero,
  part.ticker,
  part.shop,
  part.reviews,
].join('\n')

let bytes = 0
bytes += compose({
  slug: 'index',
  current: '',
  head: headFor({
    title: 'Glen Smoke Shop — Vape, Nicotine Pouches, Glass &amp; Cigars in Glen Ellyn, IL',
    desc: "Glen Ellyn's deepest selection of disposable vapes, ZYN and nicotine pouches, hand-blown glass, premium cigars, hookah and rolling papers. 944 Roosevelt Rd. Call or text (331) 551-0005.",
    url: `${SITE}/`,
  }),
  body: hubBody,
})

/* -------------------------------------------------------------- sections -- */

for (const s of SECTIONS) {
  const body = [
    sectionHead(s),
    ...s.parts.map(p => part[p]),
    moreDoors(s.slug),
  ].join('\n')

  bytes += compose({
    slug: s.slug,
    current: s.slug,
    head: headFor({
      title: s.title,
      desc: s.desc,
      url: `${SITE}${pathFor(s.slug)}`,
      extra: breadcrumbs(s) + itemListFor(s),
    }),
    body,
  })
}

/* ---------------------------------------------------------------- shop -- */
/* The master index is rendered into the HTML at BUILD time, not by the client.

   The whole value of this page is that a crawler can read 97 brands and 615
   product names on it. A client-rendered list is invisible to that crawler,
   which would leave the site with a search box that helps nobody find it. The
   filtering on top is progressive enhancement; the content is not. */
const SHELF = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/shelf.json'), 'utf8'))

const CAT_PAGE = {
  disposable: '/vapes', hardware: '/vapes', cigar: '/cigars',
  paper: '/papers', wrap: '/papers', gear: '/gear', hookah: '/hookah',
}
const CAT_LABEL = {
  disposable: 'Disposables', hardware: 'Vape hardware', cigar: 'Cigars',
  paper: 'Papers', wrap: 'Wraps', gear: 'Gear', hookah: 'Hookah',
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function shopBody() {
  const brands = Object.values(SHELF.brands)
    .sort((a, b) => a.brand.localeCompare(b.brand))

  const cards = brands.map(b => {
    const items = Object.entries(b.lines).flatMap(([line, list]) =>
      list.map(i => ({ line, name: i.name })))
    const cat = CAT_LABEL[b.category] || b.category
    const href = CAT_PAGE[b.category] || '/'
    // Data attributes carry the haystack so the filter never has to walk the DOM.
    const hay = esc([b.brand, cat, ...items.map(i => i.name), ...Object.keys(b.lines)].join(' ').toLowerCase())
    // NO .reveal on these. Reveal elements start at opacity 0 and are turned on
    // by a scroll observer; a card that is display:none when that observer runs
    // never gets turned on, so filtering to it produced a card that was
    // un-hidden and still invisible. The grid as a whole reveals instead.
    return `<article class="shop-card" id="b-${esc(b.catalogId || b.brand.toLowerCase().replace(/\W+/g, '-'))}"
      data-cat="${esc(b.category)}" data-hay="${hay}">
      <header class="shop-card-head">
        <h3 class="shop-brand">${esc(b.brand)}</h3>
        <a class="shop-cat" href="${href}" data-prefetch>${esc(cat)}</a>
      </header>
      <p class="shop-n">${items.length} on the shelf</p>
      <ul class="shop-items">${items.map(i => `<li>${esc(i.name)}</li>`).join('')}</ul>
    </article>`
  }).join('\n')

  const counts = {}
  for (const b of brands) counts[b.category] = (counts[b.category] || 0) + 1
  const filters = ['all', ...Object.keys(counts).sort()].map(c =>
    `<button class="shop-chip${c === 'all' ? ' on' : ''}" data-cat="${c}">${c === 'all' ? 'Everything' : esc(CAT_LABEL[c] || c)}</button>`
  ).join('')

  const items = brands.reduce((n, b) => n + Object.values(b.lines).reduce((m, l) => m + l.length, 0), 0)

  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: 'Everything Glen Smoke Shop carries',
    numberOfItems: brands.length,
    itemListElement: brands.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.brand })),
  }

  return part.shopindex
    .replace('<div class="shop-filters" id="shop-filters" role="group" aria-label="Filter by category"></div>',
             `<div class="shop-filters" id="shop-filters" role="group" aria-label="Filter by category">${filters}</div>`)
    .replace('<div class="shop-grid" id="shop-grid"></div>',
             `<div class="shop-grid reveal" id="shop-grid">\n${cards}\n</div>`)
    .replace('<p class="shop-count" id="shop-count" aria-live="polite"></p>',
             `<p class="shop-count" id="shop-count" aria-live="polite">${brands.length} brands · ${items} products</p>`)
    + `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`
}

bytes += compose({
  slug: 'shop',
  current: 'shop',
  head: headFor({
    title: 'Every Brand We Carry — Glen Smoke Shop, Glen Ellyn IL',
    desc: 'The full shelf at Glen Smoke Shop, 944 Roosevelt Rd, Glen Ellyn: every disposable, cigar, wrap, paper, hookah and gear brand we stock, searchable.',
    url: `${SITE}/shop`,
  }),
  body: shopBody(),
})

/* ------------------------------------------------------------------ 404 -- */
/* Cloudflare Pages serves 404.html with a real 404 status for any unmatched
   path. Without this file it falls back to index.html and answers 200 OK —
   so every broken link and every typo'd URL looked like a working page, and
   Google would happily index an unlimited number of them as duplicates of the
   home page. Measured before this existed: /img/definitely-not-a-real-file
   returned 200 with the home page's HTML. */
bytes += compose({
  slug: '404',
  current: '',
  head: headFor({
    title: 'Page not found — Glen Smoke Shop, Glen Ellyn IL',
    desc: 'That page could not be found. Browse vapes, pouches, glass, cigars, papers, gear and hookah at Glen Smoke Shop, 944 Roosevelt Rd, Glen Ellyn.',
    url: `${SITE}/404`,
    extra: '<meta name="robots" content="noindex">',
  }),
  body: part.notfound,
})

/* -------------------------------------------------------------- sitemap -- */

const today = process.env.SOURCE_DATE || new Date().toISOString().slice(0, 10)
/* 'shop' is listed explicitly because it is not a SECTION — it is composed
   separately below the section loop. Deriving this list from SECTIONS alone
   left the master index out of the sitemap AND out of every nav, on a page
   whose own source comment says "the crawler is the entire point of this
   page". 404 is excluded on purpose: it ships noindex. */
const urls = ['', ...SECTIONS.map(s => s.slug), 'shop']
fs.writeFileSync(path.join(ROOT, 'public/sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url>
    <loc>${SITE}/${u}</loc>
    <lastmod>${today}</lastmod>
    <priority>${i === 0 ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`)

console.log(`built ${1 + SECTIONS.length} pages (${(bytes / 1024).toFixed(0)}kB of HTML) + sitemap`)
