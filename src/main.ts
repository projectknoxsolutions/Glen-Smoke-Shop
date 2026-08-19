/* ==========================================================================
   Glen Smoke Shop — Neon Noir
   Project Knox Solutions
   ========================================================================== */

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/sections.css'
import './styles/entrance.css'
import './styles/pages.css'
import './styles/signhero.css'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import catalog from './data/catalog.json'
import store from './data/store.json'
import reviewData from './data/reviews.json'
import pouchImages from './data/pouch-images.json'
import vapeItems from './data/vape-items.json'
import cigarItems from './data/cigar-items.json'
import shelfData from './data/shelf.json'

import { initEntrance } from './entrance'
import { initLogo3D } from './logo3d'
import { bind as bindDetail, describe, openFromHash } from './detail'

gsap.registerPlugin(ScrollTrigger)

const $  = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[]
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------------------------------------------------------------- images */
/* picture() and photo() used to live here, building <picture> markup in the
   browser for the category grid, the section figures and the tour mosaic.
   All three are rendered at build time now, so both helpers moved to
   scripts/blocks.mjs and nothing on this side emits an <img> any more. */

/* ---------------------------------------------------------------- 21+ room */

/** Set and read only by the 21+ Room's own confirmation. See initPortal. */
const ROOM21_KEY = 'gss.room21.v1'

/* ------------------------------------------------------------- contact */
function initContact() {
  const tel = `tel:${store.phone}`
  $$('[data-call]').forEach(a => a.setAttribute('href', tel))

  // If the line is not confirmed SMS-capable, a text button that silently does
  // nothing is worse than no text button. Fall back to a call and relabel.
  $$('[data-sms]').forEach(a => {
    if (store.smsCapable) {
      a.setAttribute('href', `sms:${store.phone}`)
    } else {
      a.setAttribute('href', tel)
      a.setAttribute('title', 'Call the shop')
      const label = $('.v', a)
      if (label) label.textContent = store.phoneDisplay
    }
  })

  const q = encodeURIComponent(`${store.name}, ${store.street}, ${store.locality}, ${store.region} ${store.postalCode}`)
  $$('[data-directions]').forEach(a => {
    a.setAttribute('href', `https://www.google.com/maps/dir/?api=1&destination=${q}`)
    a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener')
  })

  $$('[data-phone-display], [data-sms-display]').forEach(e => { e.textContent = store.phoneDisplay })
  const rl = $('#review-link'); if (rl) rl.setAttribute('href', store.googleUrl)
  const y = $('#year'); if (y) y.textContent = String(new Date().getFullYear())
}

/* --------------------------------------------------------------- hours */
type Slot = { day: string; open: string; close: string }
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

function storeNow() {
  // Read wall-clock time in the store's timezone regardless of the visitor's.
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: store.timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]))
  let hour = parseInt(p.hour, 10); if (hour === 24) hour = 0
  return { day: p.weekday as string, minutes: hour * 60 + parseInt(p.minute, 10) }
}

function openState() {
  const now = storeNow()
  const today = (store.hours as Slot[]).find(h => h.day === now.day)
  if (!today) return { open: false, label: 'Call for hours' }

  const o = mins(today.open)
  const c = mins(today.close) <= o ? mins(today.close) + 1440 : mins(today.close)  // past-midnight closes
  const isOpen = now.minutes >= o && now.minutes < c

  const pretty = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hh = h % 12 === 0 ? 12 : h % 12
    return m ? `${hh}:${String(m).padStart(2, '0')} ${ampm}` : `${hh} ${ampm}`
  }
  return {
    open: isOpen,
    label: isOpen ? `Open now · until ${pretty(today.close)}` : `Closed · opens ${pretty(today.open)}`,
  }
}

let lastOpenLabel = ''

function initHours() {
  const st = openState()
  const pill = $('#open-state')
  // aria-live fires on any subtree change, so rewriting identical text every
  // minute made screen readers re-announce the status all session. Only touch
  // the DOM when the label actually changes.
  if (pill && st.label !== lastOpenLabel) {
    lastOpenLabel = st.label
    pill.className = `pill ${st.open ? 'live' : 'shut'}`
    const label = $('span', pill)
    if (label) label.textContent = st.label
    else pill.innerHTML = `<i class="dot"></i><span>${st.label}</span>`
  }

  const body = $('#hours-table tbody')
  if (!body) return
  const today = storeNow().day
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hh = h % 12 === 0 ? 12 : h % 12
    return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`
  }
  body.innerHTML = (store.hours as Slot[])
    .map(h => `<tr class="${h.day === today ? 'today' : ''}">
        <td>${h.day}</td><td>${fmt(h.open)} — ${fmt(h.close)}</td></tr>`)
    .join('')
}

/* --------------------------------------------------------------- ticker */
function initTicker() {
  const el = $('#ticker'); if (!el) return
  const items = [
    'Disposable Vapes', 'ZYN & Pouches', 'Hand-Blown Glass', 'Premium Cigars',
    'Rolling Papers', 'Hookah', 'Grinders & Torches', 'E-Liquid', 'Kratom & Kava',
  ]
  const run = items.map(i => `<span class="ticker-item">${i}</span>`).join('')
  el.innerHTML = run + run                      // duplicated for a seamless -50% loop
}

/* ----------------------------------------------------------- hero stats */
function initHeroStats() {
  const el = $('#hero-stats'); if (!el) return
  // Build-time markup wins. scripts/build-pages.mjs renders these four figures
  // into the HTML from the same catalog.json this function reads, so a crawler
  // and a no-JS visitor both get real numbers. Re-rendering here would only
  // reintroduce the window where they do not exist.
  if (el.children.length) return
  const stats = [
    { n: `${catalog.vapes.length}+`,   l: 'Vape brands' },
    { n: `${catalog.pouches.length}`,  l: 'Pouch flavors' },
    { n: `${catalog.glass.count}`,     l: 'Glass pieces' },
    { n: `${catalog.cigars.length}`,   l: 'Cigar houses' },
  ]
  // Render the real figure as the initial text. The count-up only runs when
  // motion is allowed, so reduced-motion visitors see the numbers, not zeroes.
  // The suffix is carried in a data attribute rather than sniffed from
  // textContent, which previously dropped the "+" for everyone.
  el.innerHTML = stats.map(s => {
    const n = parseInt(s.n, 10)
    const suffix = s.n.replace(String(n), '')
    return `<div class="hero-stat">
      <div class="n" data-count="${n}" data-suffix="${suffix}">${s.n}</div>
      <div class="l">${s.l}</div></div>`
  }).join('')
}

/* ------------------------------------------------- server-rendered blocks */
/* The category doors, the gear cards and the 21+ room cards used to be built
   here, into empty <div>s that shipped in the HTML. That put the eight category
   names, every gear brand and every botanical brand behind a script tag, which
   is the one place a smoke shop's words are worth nothing.
   They are rendered at BUILD time now — see scripts/blocks.mjs, which owns the
   markup, the data and the <picture> set. Nothing renders them here any more;
   the code was deleted rather than guarded, because two copies of the same
   markup drift and a guard hides the drift. */

/* ---------------------------------------------------------------- shop */
/* Filters the master index. Progressive enhancement ONLY — every card and
   every product name is already in the HTML from the build, because a crawler
   that cannot see 615 product names makes this page pointless. If this never
   runs, the visitor gets the complete list and the browser's own find-in-page,
   which is a perfectly good fallback. */
function initShopIndex() {
  const grid = $('#shop-grid'); if (!grid) return
  const q = $('#shop-q') as HTMLInputElement | null
  const chips = $$('.shop-chip')
  const count = $('#shop-count')
  const empty = $('#shop-empty')
  const cards = $$<HTMLElement>('.shop-card')

  let term = '', cat = 'all'

  const apply = () => {
    let shown = 0
    for (const c of cards) {
      const okCat = cat === 'all' || c.dataset.cat === cat
      // Word-START matching, not substring. Plain .includes() meant searching
      // "raw" returned eleven brands because it matches STRAWberry — the one
      // brand actually called RAW was buried among flavour names. Matching on
      // word starts keeps partial typing working ("geek", "vapor") while
      // "raw" now finds RAW.
      const okTerm = !term || (c.dataset.hay || '').split(' ').some(w => w.startsWith(term))
      const on = okCat && okTerm
      c.hidden = !on
      if (on) shown++
    }
    if (count) count.textContent = shown === cards.length
      ? `${cards.length} brands · 615 products`
      : `${shown} brand${shown === 1 ? '' : 's'} matching`
    if (empty) empty.hidden = shown !== 0
  }

  // Debounced: the haystack lives in a data attribute so each pass is a string
  // compare over ~100 nodes, but typing fires this on every keystroke and there
  // is no reason to run it faster than the eye can read the result.
  let t = 0
  q?.addEventListener('input', () => {
    clearTimeout(t)
    t = window.setTimeout(() => { term = q.value.trim().toLowerCase(); apply() }, 120)
  })

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.toggle('on', c === chip))
      cat = (chip as HTMLElement).dataset.cat || 'all'
      apply()
    })
  }
}

/* --------------------------------------------------------------- photos */
/* The section photographs used to be injected here, into <figure> elements
   that shipped empty. Twenty-nine shelf shots with careful alt text, none of
   them in the document a crawler downloads and none of them visible to the
   browser's preload scanner. They are built into the HTML now — the figures
   still carry data-photo and data-alt, which is where the slug and the alt
   text are authored; scripts/blocks.mjs reads them at build time. */

/* --------------------------------------------------------------- shelf */

/* What is actually on the wall, read off the shop's own 48MP frames. Keyed by
   the catalog brand id so it hangs off the existing chips rather than becoming
   a second taxonomy. */
type ShelfItem = { id: string; name: string; legibility: string; notes?: string }
type ShelfBrand = { brand: string; category: string; catalogId: string | null; count: number; lines: Record<string, ShelfItem[]> }

const SHELF = shelfData.brands as unknown as Record<string, ShelfBrand>

const shelfByCatalogId = new Map<string, ShelfBrand>()
for (const b of Object.values(SHELF)) if (b.catalogId) shelfByCatalogId.set(b.catalogId, b)

/** The flavours for one brand, grouped by product line. */
function shelfMarkup(b: ShelfBrand): string {
  const lines = Object.entries(b.lines)
  const total = b.count
  const chip = (f: ShelfItem) =>
    `<li class="flav${f.legibility !== 'clear' ? ' is-soft' : ''}"${f.legibility !== 'clear'
      ? ' title="Read partially off the packaging — ask us to confirm"' : ''}>${f.name}</li>`

  return `
    <div class="shelf">
      <p class="shelf-head"><strong>${total}</strong> ${total === 1 ? 'flavour' : 'flavours'} of ${b.brand} on the wall right now</p>
      ${lines.map(([line, items]) => `
        <div class="shelf-line">
          ${line !== '—' ? `<p class="shelf-line-name">${line}</p>` : ''}
          <ul class="flav-list">${items.map(chip).join('')}</ul>
        </div>`).join('')}
      <p class="shelf-note">Counted off our own shelf photos, not a brand catalogue — if it is listed here we stocked it. The wall turns over fast, so call or text to confirm a specific one.</p>
    </div>`
}

/* ---------------------------------------------------------- vape brands */
/* The 43 brand chips and the hardware chips are in the HTML from the build
   (scripts/blocks.mjs). This wires the panel they open — which is behaviour,
   and stays in the browser. The panel body is still built here on demand:
   it is one brand at a time, it is behind a click, and rendering all 43 of
   them into the page to satisfy a crawler that already has every brand NAME
   would trade a real page-weight cost for nothing. */
function initVapes() {
  const list = $('#vape-brands'), detail = $('#vape-detail')
  if (!list || !detail) return

  const show = (id: string) => {
    const v = catalog.vapes.find(x => x.id === id)!
    const d = describe(id)
    const shelf = shelfByCatalogId.get(id)
    detail.innerHTML = `
      <h3>${v.brand}</h3>
      ${d?.blurb ? `<p class="brand-blurb">${d.blurb}</p>` : ''}
      ${shelf ? shelfMarkup(shelf) : (v.lines.length
        ? `<div class="lines">${v.lines.map(l => `<span>${l}</span>`).join('')}</div>`
        : '')}
      ${d ? `<button class="btn btn-more" type="button" data-detail="${id}">What it is &amp; who it suits</button>` : ''}`
    detail.classList.add('open')
  }

  $$('[data-brand]', list).forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true'
      $$('[data-brand]', list).forEach(b => b.setAttribute('aria-expanded', 'false'))
      if (open) { detail.classList.remove('open'); return }
      btn.setAttribute('aria-expanded', 'true')
      show(btn.getAttribute('data-brand')!)
    })
  })
}

/* ------------------------------------------------------------------- 3D */
// Order matters: whichever sits first is what the viewer opens on, and the blue
// Caliburn renders dark enough on a phone at arm's length that it read as
// broken rather than blue. Geek Bar leads — it is the anchor brand on the wall
// and it is the brightest of the three.
//
// The Geek Bar mesh ships unlabelled on purpose. The image-to-3D pass baked a
// smeared approximation of the wordmark into the texture, and illegible
// pseudo-lettering on a real brand's product looks like a counterfeit. It was
// painted out; the label below the viewer does the naming.
const MODELS = [
  { id: 'geekbar',       name: 'Geek Bar Pulse',    finish: 'Blue', hex: '#3B7BE8' },
  { id: 'caliburn-red',  name: 'Uwell Caliburn G2', finish: 'Red',  hex: '#C0272D' },
  { id: 'caliburn-blue', name: 'Uwell Caliburn G2', finish: 'Blue', hex: '#2C5FD6' },
]

function init3D() {
  const stage = $('#hw-stage'), swatches = $('#hw-swatches'), block = $('#hw-3d')
  if (!stage || !swatches || !block) return

  // model-viewer is ~150KB of runtime plus a 1MB mesh each. Neither is fetched
  // until the section is actually approached, so the rest of the page is never
  // taxed for a feature most visitors scroll past.
  let loaded = false
  const io = new IntersectionObserver(async entries => {
    if (!entries[0].isIntersecting || loaded) return
    loaded = true
    io.disconnect()
    try {
      await import('@google/model-viewer')
    } catch {
      stage.innerHTML = `<div class="hw-fallback"><p>3D preview isn\'t supported in this browser — come see them in person.</p></div>`
      return
    }
    mount()
  }, { rootMargin: '600px' })
  io.observe(block)

  const mount = () => {
    stage.innerHTML = `
      <model-viewer id="mv" camera-controls touch-action="pan-y" disable-zoom
        interaction-prompt="none" environment-image="neutral" exposure="1.75"
        shadow-intensity="0.35" shadow-softness="1"
        camera-orbit="20deg 76deg 2.9m" field-of-view="30deg"
        min-camera-orbit="auto 25deg 2.9m" max-camera-orbit="auto 150deg 2.9m"
        alt="A rotatable 3D model of a device sold at Glen Smoke Shop"
        src="models/${MODELS[0].id}.glb"></model-viewer>
      <span class="hw-hint">Drag to rotate</span>`

    const mv = $('#mv')!
    // Idle spin until the visitor takes over, then hand them control for good.
    let spin = true
    const tick = () => {
      if (!spin) return
      const o = (mv as any).getCameraOrbit?.()
      if (o) (mv as any).cameraOrbit = `${o.theta * 180 / Math.PI + 0.22}deg ${o.phi * 180 / Math.PI}deg ${o.radius}m`
      requestAnimationFrame(tick)
    }
    if (!reduced) requestAnimationFrame(tick)
    const stop = () => { spin = false; stage.classList.add('touched') }
    mv.addEventListener('pointerdown', stop)
    mv.addEventListener('wheel', stop, { passive: true })

    swatches.innerHTML = MODELS.map((m, i) =>
      `<button class="hw-swatch" data-model="${m.id}" aria-pressed="${i === 0}">
         <i style="background:${m.hex}"></i>${m.name} · ${m.finish}
       </button>`).join('')
    $$('[data-model]', swatches).forEach(btn => {
      btn.addEventListener('click', () => {
        $$('[data-model]', swatches).forEach(b => b.setAttribute('aria-pressed', String(b === btn)))
        mv.setAttribute('src', `models/${btn.getAttribute('data-model')}.glb`)
      })
    })
  }
}

/* -------------------------------------------------------------- pouches */
const FLAVOR_TINT: Record<string, string> = {
  mint: '#4FC3F7', peppermint: '#4FC3F7', 'cool mint': '#4FC3F7', 'arctic mint': '#7FDBFF',
  menthol: '#26C6DA', 'menthol ice': '#26C6DA', wintergreen: '#2E7D5B', 'wintergreen blast': '#34A06E',
  spearmint: '#3FBF8F', 'fresh spearmint': '#3FBF8F', 'peppermint frost': '#5EC8F0',
  chill: '#8E9BB3', 'chill mist': '#8E9BB3', smooth: '#B9C2D0', 'signature smooth': '#C7B27A',
  citrus: '#D7DF23', 'citrus zest': '#D7DF23', coffee: '#795548', 'espresso martini': '#2B2F45',
  cinnamon: '#C0392B', mojito: '#7CB342', 'spiced cider': '#E07A3F', peach: '#F5A65B',
  dragonberry: '#8BC34A', 'black cherry': '#7B1F3A', cappuccino: '#A9784B', 'dragon fruit': '#D6386B',
}
const tintFor = (f: string) => FLAVOR_TINT[f.toLowerCase()] || '#9AA6BE'

/* ------------------------------------------------------- product shelves */
/* The pouch grid, generalised. The owner named that grid as the best thing on
   the site, so the disposable wall and the humidor now get the same treatment:
   one photograph per product, cut out of the shelf at native resolution.

   Deliberately ONE function driving both, unlike picture()/photo() which are
   deliberately two. The difference is what a mistake costs. There, guessing the
   wrong derivative set produces a broken <img> at runtime and nothing at build
   time. Here both grids consume manifests with the same shape, emitted by the
   same script (pipeline/items.py), and a divergence would fail the build. */
type ProductTile = {
  id: string; brand: string; line?: string
  flavor?: string; format?: string; confidence?: string
}

function initShelf(prefix: 'vape' | 'cigar', items: ProductTile[], label: string) {
  const grid = $(`#${prefix}-grid`), filters = $(`#${prefix}-filters`)
  if (!grid || !filters) return

  const sub = (i: ProductTile) => i.flavor || i.format || ''
  grid.innerHTML = items.map(i => {
    const src = `img/${prefix}/${i.id}`
    return `<button class="puck has-shot" type="button"
                 data-brand="${i.brand}" data-hay="${`${i.brand} ${i.line || ''} ${sub(i)}`.toLowerCase()}"
                 data-title="${i.brand} ${i.line || ''}" data-meta="${sub(i)}">
      <span class="puck-shot">
        <picture>
          <source type="image/avif" srcset="${src}-160.avif 160w, ${src}-320.avif 320w" sizes="(max-width:560px) 27vw, 132px">
          <img src="${src}-320.jpg" srcset="${src}-160.jpg 160w, ${src}-320.jpg 320w" sizes="(max-width:560px) 27vw, 132px"
               alt="${i.brand} ${i.line || ''} ${sub(i)} on the shelf at Glen Smoke Shop"
               loading="lazy" decoding="async" width="320" height="320">
        </picture>
      </span>
      <span class="b">${i.brand}</span>
      <span class="f">${i.line || ''}</span>
      <span class="s">${sub(i)}</span>
    </button>`
  }).join('')

  // Brands in descending facing count, so the wall's anchors lead. Alphabetical
  // put IJOY and Ploox — two facings between them — ahead of Geek Bar.
  const counts = new Map<string, number>()
  for (const i of items) counts.set(i.brand, (counts.get(i.brand) || 0) + 1)
  const brands = ['All', ...[...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0])]
  filters.innerHTML = brands.map((b, n) =>
    `<button class="filter" role="radio" data-v="${b}" aria-checked="${n === 0}">${b}</button>`).join('')

  const status = document.createElement('p')
  status.className = 'filter-status'
  status.setAttribute('aria-live', 'polite')
  grid.before(status)

  let active = 'All'
  const apply = () => {
    let shown = 0
    $$('.puck', grid).forEach(p => {
      const show = active === 'All' || p.getAttribute('data-brand') === active
      p.toggleAttribute('hidden', !show)
      if (show) shown++
    })
    status.textContent = active === 'All'
      ? `${shown} ${label} photographed on our shelves`
      : `${shown} ${active} ${shown === 1 ? 'facing' : 'facings'}`
  }

  filters.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('.filter') as HTMLElement | null
    if (!b) return
    active = b.getAttribute('data-v') || 'All'
    $$('.filter', filters).forEach(f => f.setAttribute('aria-checked', String(f === b)))
    apply()
  })
  apply()
}

function initPouches() {
  const grid = $('#pouch-grid'), filters = $('#pouch-filters')
  if (!grid || !filters) return

  const cnt = $('#pouch-count'); if (cnt) cnt.textContent = String(catalog.pouches.length)

  // Every one of these is the real can, cut out of the shop's own 48MP photo of
  // the wall. A tinted disc with the flavour name on it is a placeholder; a
  // customer recognises the lid they are looking for from across the aisle.
  // Anything we could not cut cleanly keeps the tinted disc rather than being
  // filled in with a manufacturer render.
  const imgs = pouchImages as Record<string, { src: string } | undefined>

  grid.innerHTML = catalog.pouches.map(p => {
    const c = tintFor(p.flavor)
    const strengths = p.strengths.length ? p.strengths.map(s => `${s}mg`).join(' · ') : 'Strengths vary'
    const shot = imgs[p.id]
    const face = shot
      ? `<span class="puck-shot">
           <picture>
             <source type="image/avif" srcset="${shot.src}-160.avif 160w, ${shot.src}-320.avif 320w" sizes="(max-width:560px) 27vw, 132px">
             <img src="${shot.src}-320.jpg" srcset="${shot.src}-160.jpg 160w, ${shot.src}-320.jpg 320w" sizes="(max-width:560px) 27vw, 132px"
                  alt="${p.brand} ${p.flavor} nicotine pouches" loading="lazy" decoding="async" width="320" height="320">
           </picture>
         </span>`
      : ''
    return `<button class="puck${shot ? ' has-shot' : ''}" style="color:${c}" type="button"
                 data-detail="${p.id}" data-shot="${shot ? shot.src : ''}"
                 data-title="${p.brand} ${p.flavor}" data-meta="${strengths}"
                 data-brand="${p.brand}" data-strengths="${p.strengths.join(',')}">
      ${face}
      <span class="b">${p.brand}</span>
      <span class="f">${p.flavor}</span>
      <span class="s">${strengths}</span>
    </button>`
  }).join('')

  const brands = ['All', ...catalog.pouch_brands]
  const strengths = [...new Set(catalog.pouches.flatMap(p => p.strengths))].sort((a, b) => a - b)
  filters.innerHTML =
    brands.map((b, i) => `<button class="filter" role="radio" data-f="brand" data-v="${b}" aria-checked="${i === 0}">${b}</button>`).join('') +
    strengths.map(s => `<button class="filter" data-f="mg" data-v="${s}" aria-pressed="false">${s}mg</button>`).join('')

  let brand = 'All'
  const mgOn = new Set<string>()

  const status = document.createElement('p')
  status.className = 'filter-status'
  status.setAttribute('aria-live', 'polite')
  grid.before(status)

  const apply = () => {
    let shown = 0
    $$('.puck', grid).forEach(p => {
      const okBrand = brand === 'All' || p.getAttribute('data-brand') === brand
      const list = (p.getAttribute('data-strengths') || '').split(',').filter(Boolean)
      const okMg = mgOn.size === 0 || list.some(s => mgOn.has(s))
      const show = okBrand && okMg
      p.classList.toggle('hide', !show)
      if (show) shown++
    })
    // Toggling visibility silently left screen-reader users with no idea the
    // filter did anything, and a no-match combination rendered a blank region.
    status.textContent = shown
      ? `Showing ${shown} of ${catalog.pouches.length} flavors`
      : 'No flavors match those filters — try clearing one.'
    status.classList.toggle('empty', shown === 0)
  }

  $$('[data-f]', filters).forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-f')!, val = btn.getAttribute('data-v')!
      if (kind === 'brand') {
        brand = val
        $$('[data-f="brand"]', filters).forEach(b => b.setAttribute('aria-checked', String(b === btn)))
      } else {
        const on = btn.getAttribute('aria-pressed') === 'true'
        on ? mgOn.delete(val) : mgOn.add(val)
        btn.setAttribute('aria-pressed', String(!on))
      }
      apply()
    })
  })
}

/* --------------------------------------------------- disclosure lists */
/* Cigar houses, paper brands, accessory brands and the botanical brands are
   all rendered at build time now (scripts/blocks.mjs) — including the ones
   behind "+N more", which ship inside a `hidden` <span> rather than being
   absent from the document. They are in the HTML, in the DOM, and findable by
   the browser's own find-in-page even with this script disabled.

   What is left is the disclosure, which is behaviour. It reads the count off
   data-more rather than re-deriving it, so this never has to know which of the
   five lists it is looking at. */
function initLists() {
  $$<HTMLElement>('.brand-more').forEach(more => {
    const btn = more.nextElementSibling as HTMLElement | null
    if (!btn || !btn.classList.contains('is-more')) return
    const n = btn.dataset.more || ''
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true'
      more.hidden = open
      btn.setAttribute('aria-expanded', String(!open))
      btn.textContent = open ? `+${n} more` : 'Show fewer'
      // The page just got taller or shorter by a few hundred pixels; every
      // trigger below this point is now measured against the wrong offset.
      ScrollTrigger.refresh()
    })
  })
}

/* ----------------------------------------------------------- hemp gate */
function initPortal() {
  const portal = $('#portal')
  if (!portal) return

  // MUST NOT depend on the content element. This previously read
  //   const portal = $('#portal'), forms = $('#hemp-forms')
  //   if (!portal || !forms) return
  // so when the Hemp Room became the 21+ Room and its grid was renamed to
  // #room21-grid, the whole function returned early — the unlock button
  // rendered, looked completely normal, and did nothing at all. A guard that
  // bails on a MISSING OPTIONAL is how you ship a dead button.
  const forms = $('#hemp-forms')
  if (forms) {
    forms.innerHTML = catalog.hemp_forms
      .map(f => `<div class="form-tile"><div class="n">${f.name}</div><div class="d">${f.note}</div></div>`).join('')
  }

  // This page does its own asking, once per session, and it is now the ONLY
  // place the site asks. The entrance used to carry a 21+ challenge and hand
  // its answer down to here; the owner did not want that challenge, so the
  // entrance is a pure opening shot and this confirmation stands alone. Note
  // what that means: the flag is set HERE and read HERE, and nothing upstream
  // can unlock this shelf. When the entrance stopped asking, the variable it
  // used to set became permanently true — wiring this to it would have quietly
  // unlocked the one thing that is supposed to be locked.
  let confirmed = false
  try { confirmed = sessionStorage.getItem(ROOM21_KEY) === 'ok' } catch { /* private mode */ }
  if (confirmed) portal.classList.add('unlocked')

  $('#portal-unlock')?.addEventListener('click', () => {
    portal.classList.add('unlocked')
    try { sessionStorage.setItem(ROOM21_KEY, 'ok') } catch { /* private mode */ }
    ScrollTrigger.refresh()
  })
}

/* -------------------------------------------------------- gallery feed */
/* The Project Knox embed mounts itself and, when the feed is empty, deletes its
   own container. That is reasonable behaviour for an embed and useless for a
   page whose entire job is to show it — an empty feed would leave a heading
   followed by nothing.
 *
 * So the empty state is real markup that starts visible, and this hides it once
 * a tile actually lands. A MutationObserver rather than a timeout: the embed is
 * async and fetches over the network, so there is no interval that is both
 * short enough not to flash and long enough to be reliable on a slow
 * connection. The observer also handles the feed going back to empty, which
 * happens when the shop deletes its last photo. */
function initGalleryFeed() {
  const host = $('#knox-gallery'), empty = $('#gallery-empty')
  if (!host || !empty) return

  const settle = () => {
    const grid = host.querySelector('[data-knox-gallery-grid]')
    empty.toggleAttribute('hidden', !!grid && grid.children.length > 0)
  }

  settle()
  const mo = new MutationObserver(settle)
  mo.observe(host, { childList: true, subtree: true })

  // The embed can also fail outright — blocked, offline, or a bad response. It
  // exits silently by design, so nothing would ever arrive and the observer
  // would wait forever. After a generous window, stop watching and leave the
  // empty state up, which is the honest thing to show either way.
  setTimeout(() => mo.disconnect(), 15000)
}

/* -------------------------------------------------------------- gallery */
/* -------------------------------------------------------------- reviews */
type Review = { name: string; initial?: string; stars: number; text: string; date?: string }
const AV = ['#FF8A1E', '#2E6BFF', '#FF2D9B', '#35FF7A', '#FFC24D']

function initReviews() {
  const host = $('#review-marquee'); if (!host) return
  const list = (reviewData.reviews || []) as Review[]

  // No fabricated testimonials, ever. Until real reviews are supplied the
  // section degrades to an honest link-out rather than inventing quotes.
  // With no reviews supplied, the marquee is removed entirely rather than
  // rendering a placeholder that tells visitors the site is unfinished. The
  // rating and the Google link above it still carry the section.
  if (!list.length) {
    host.remove()
    return
  }

  const card = (r: Review, i: number) => {
    const init = r.initial || r.name.trim()[0]?.toUpperCase() || '?'
    const full = Math.round(r.stars)
    return `<article class="rev-card">
      <p class="t">"${r.text}"</p>
      <div class="m">
        <span class="av" style="background:${AV[i % AV.length]}">${init}</span>
        <span><span class="nm">${r.name}</span>
          <span class="st" style="display:block">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span></span>
      </div></article>`
  }

  // Two counter-scrolling rows only make sense with enough cards to fill both.
  // With three real reviews, splitting them 2/1 left the second row visibly
  // thin and drew attention to how few there are. Under six, run a single row
  // and repeat it enough times to cover the widest viewport instead.
  const row = (rs: Review[], cls: string, reps: number) =>
    `<div class="rev-row ${cls}">${Array.from({ length: reps }, () => rs.map(card).join('')).join('')}</div>`

  if (list.length < 6) {
    host.innerHTML = row(list, 'a', Math.max(3, Math.ceil(9 / list.length)))
  } else {
    const half = Math.ceil(list.length / 2)
    host.innerHTML = row(list.slice(0, half), 'a', 2) + row(list.slice(half), 'b', 2)
  }
}

/* ------------------------------------------------------------------ map */
function initMap() {
  const frame = $('#map-frame'); if (!frame) return
  // Deferred until scrolled near: a third-party iframe on load would wreck LCP.
  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return
    io.disconnect()
    const q = encodeURIComponent(`${store.street}, ${store.locality}, ${store.region} ${store.postalCode}`)
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${q}`
    const fallback = () => {
      frame.innerHTML = `
        <div class="map-fallback">
          <div>${store.street}<br>${store.locality}, ${store.region} ${store.postalCode}</div>
          <a class="btn btn-call" href="${dir}" target="_blank" rel="noopener">Open in Maps</a>
        </div>`
    }
    frame.innerHTML =
      `<iframe title="Map to Glen Smoke Shop" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        style="position:absolute;inset:0" src="https://maps.google.com/maps?q=${q}&z=16&output=embed"></iframe>`
    const f = frame.querySelector('iframe') as HTMLIFrameElement
    // The fallback is only rendered if the embed fails. Painting it underneath a
    // working iframe left a link that keyboard users could reach but not see.
    let ok = false
    f.addEventListener('load', () => { ok = true })
    f.addEventListener('error', fallback)
    setTimeout(() => { if (!ok) { f.remove(); fallback() } }, 6000)
  }, { rootMargin: '400px' })
  io.observe(frame)
}

/* ------------------------------------------------------------- motion */
function initMotion() {
  if (!reduced) {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(t => lenis.raf(t * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  const nav = $('#nav')!
  ScrollTrigger.create({ start: 60, onUpdate: s => nav.classList.toggle('stuck', s.scroll() > 60) })

  $$('.reveal').forEach(el => {
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('in') })
  })

  if (!reduced) {
    // Hero parallax: the storefront drifts slower than the copy over it.
    const media = $('.hero-media')
    if (media) {
      gsap.to(media, {
        yPercent: 14, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      })
    }

    $$('[data-count]').forEach(el => {
      const target = Number(el.getAttribute('data-count')) || 0
      const suffix = el.getAttribute('data-suffix') || ''
      // Zero it INSIDE onEnter, not here. Zeroing at init and only restoring
      // the real figure when the element scrolls into view meant the counters
      // read "0+ VAPE BRANDS" for as long as they stayed below the fold —
      // which on a phone is until you scroll, and forever if the trigger never
      // fires. The markup now ships with the real numbers in it; the animation
      // borrows them for a second and a half and gives them back.
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => {
          el.textContent = '0' + suffix
          gsap.to({ v: 0 }, {
            v: target, duration: 1.5, ease: 'power2.out',
            onUpdate() { el.textContent = Math.round((this.targets()[0] as any).v) + suffix },
            onComplete() { el.textContent = target + suffix },
          })
        },
      })
    })

    // Section titles rise as they enter, staggered against their kicker.
    $$('.sec-head').forEach(head => {
      const kids = $$('.sec-kicker, .sec-title, .sec-lede', head)
      gsap.from(kids, {
        yPercent: 40, opacity: 0, duration: .9, stagger: .09, ease: 'power3.out',
        scrollTrigger: { trigger: head, start: 'top 84%', once: true },
      })
    })
  }

}

/* --------------------------------------------------------------- details */

/* One delegated listener for the whole document: every brand chip, cigar name,
   hardware button and pouch face carries `data-detail`, and the grids re-render
   on filter changes, so binding per element would mean rebinding constantly. */
function initDetails() {
  bindDetail(document, el => ({
    shot: el.getAttribute('data-shot') || undefined,
    title: el.getAttribute('data-title') || undefined,
    meta: el.getAttribute('data-meta') || undefined,
  }))
  // A link like /pouches.html#zyn-chill opens straight onto that flavour.
  openFromHash()
}

/* ------------------------------------------------------------- prefetch */

/* Nine separate documents would normally mean nine navigations that feel like
   navigations. They do not, because the shared CSS and JS bundle is already in
   cache after the first view and the only new bytes are ~14kB of HTML — and
   because we fetch that HTML the moment a finger lands on a link, roughly
   100-200ms before the tap completes. */
function initPrefetch() {
  if (matchMedia('(prefers-reduced-data: reduce)').matches) return
  const done = new Set<string>()
  const warm = (href: string) => {
    if (!href || done.has(href)) return
    done.add(href)
    const l = document.createElement('link')
    l.rel = 'prefetch'; l.href = href; l.as = 'document'
    document.head.appendChild(l)
  }
  const from = (e: Event) => {
    const a = (e.target as Element)?.closest?.('a[data-prefetch]') as HTMLAnchorElement | null
    if (a) warm(a.getAttribute('href') || '')
  }
  document.addEventListener('pointerenter', from, { capture: true, passive: true })
  document.addEventListener('touchstart', from, { capture: true, passive: true })
  document.addEventListener('focusin', from, { passive: true })
}

/* --------------------------------------------------------------- boot */
function boot() {
  // The entrance no longer gates anything — it is the opening shot and it
  // dismisses itself. Nothing downstream waits on it.
  initEntrance({ onPass: () => ScrollTrigger.refresh() })
  initContact()
  initHours()
  initTicker()
  initHeroStats()
  initShopIndex()
  initVapes()
  init3D()
  initPouches()
  initShelf('vape', vapeItems as ProductTile[], 'disposables')
  initShelf('cigar', cigarItems as ProductTile[], 'cigars')
  initLists()
  initPortal()
  initGalleryFeed()
  initReviews()
  initMap()
  initMotion()
  initPrefetch()
  initLogo3D()
  initDetails()
  setInterval(initHours, 60_000)   // keep open/closed honest without a reload
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot()
