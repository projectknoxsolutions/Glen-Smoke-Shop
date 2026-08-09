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
  hookah: P('hookah.html'),
  hemp: P('hemp.html'),
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
    slug: 'hookah', nav: 'Hookah', tile: 'Hookah & botanicals',
    title: 'Hookah, Shisha & Botanicals — Glen Smoke Shop, Glen Ellyn IL',
    desc: 'Hookahs, bowls, hoses, coals and heat management at 944 Roosevelt Rd, Glen Ellyn, alongside our botanical shelf.',
    kicker: '06 — Hookah & botanicals',
    lede: 'Bowls, hoses, coals and heat management.',
    img: 'IMG_6074', parts: ['hookah'],
  },
  {
    slug: 'hemp', nav: 'Hemp room', tile: 'Behind the counter',
    title: 'Hemp Room — Behind the Counter at Glen Smoke Shop, Glen Ellyn IL',
    desc: 'The hemp-derived shelf at Glen Smoke Shop, Glen Ellyn. Categories only. You must be 21 or older; we card everyone, every time.',
    kicker: '07 — Behind the counter',
    lede: 'Kept behind the counter, and we card for it.',
    img: 'IMG_6081', parts: ['hemp'],
  },
  {
    slug: 'visit', nav: 'Visit', tile: 'Visit the shop',
    title: 'Visit Glen Smoke Shop — 944 Roosevelt Rd, Glen Ellyn, IL',
    desc: 'Hours, directions, phone and text for Glen Smoke Shop at 944 Roosevelt Rd, Glen Ellyn, Illinois. Call or text (331) 551-0005.',
    kicker: '08 — Visit',
    lede: 'Where we are, when we are open, and how to reach us.',
    img: 'IMG_6070', parts: ['visit', 'tour', 'reviews'],
  },
]

/* -------------------------------------------------------------- helpers -- */

const navHtml = (current) => `
  <div class="nav-links">
    ${SECTIONS.filter(s => s.slug !== 'visit').map(s =>
      `<a href="${s.slug}.html"${s.slug === current ? ' aria-current="page"' : ''} data-prefetch>${s.nav}</a>`
    ).join('\n    ')}
    <a href="visit.html"${current === 'visit' ? ' aria-current="page"' : ''} data-prefetch>Visit</a>
  </div>`

/** The strip of other doors that closes every section page. */
const moreDoors = (current) => `
<section class="section more-doors">
  <div class="wrap">
    <p class="sec-kicker">More of the shop</p>
    <div class="door-strip">
      ${SECTIONS.filter(s => s.slug !== current).map(s =>
        `<a class="door-chip" href="${s.slug}.html" data-prefetch>${s.tile}</a>`).join('\n      ')}
    </div>
  </div>
</section>`

/** Compact masthead for a section page — the storefront, one line of type. */
const sectionHead = (s) => `
<header class="pagehead" id="top">
  <div class="pagehead-media" aria-hidden="true">
    <picture>
      <source type="image/avif" sizes="100vw"
        srcset="img/hero-wide-1600.avif 1600w, img/hero-wide-2200.avif 2200w">
      <img src="img/hero-wide-1600.jpg" alt="" decoding="async" fetchpriority="high">
    </picture>
  </div>
  <div class="pagehead-sign" aria-hidden="true">
    <picture>
      <source type="image/avif" sizes="100vw"
        srcset="img/hero-wide-1600.avif 1600w, img/hero-wide-2200.avif 2200w">
      <img src="img/hero-wide-1600.jpg" alt="" decoding="async">
    </picture>
  </div>
  <div class="pagehead-scrim" aria-hidden="true"></div>
  <div class="wrap pagehead-body">
    <a class="backlink" href="index.html" data-prefetch>
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
 {"@type":"ListItem","position":2,"name":${JSON.stringify(s.tile)},"item":"${SITE}/${s.slug}.html"}]}
</script>`

/** Rewrite the shared <head> for one page. */
function headFor({ title, desc, url, extra = '' }) {
  let h = part.head
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
  h = h.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${desc}$2`)
  h = h.replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${url}$2`)
  h = h.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${title}$2`)
  h = h.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${desc}$2`)
  h = h.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${url}$2`)
  return h.replace('</head>', `${extra}\n</head>`)
}

function compose({ slug, head, body, current }) {
  const premain = part.premain.replace(/<div class="nav-links">[\s\S]*?<\/div>/, navHtml(current).trim())
  let out = [head, premain, '<main id="main" class="shell">', body, part.postmain].join('\n')
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
      url: `${SITE}/${s.slug}.html`,
      extra: breadcrumbs(s),
    }),
    body,
  })
}

/* -------------------------------------------------------------- sitemap -- */

const today = process.env.SOURCE_DATE || new Date().toISOString().slice(0, 10)
const urls = ['', ...SECTIONS.map(s => `${s.slug}.html`)]
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
