/* ==========================================================================
   Glen Smoke Shop — Neon Noir
   Project Knox Solutions
   ========================================================================== */

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/sections.css'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import catalog from './data/catalog.json'
import store from './data/store.json'
import reviewData from './data/reviews.json'

gsap.registerPlugin(ScrollTrigger)

const $  = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[]
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------------------------------------------------------------- images */
/** Responsive <picture> against the AVIF/WebP/JPEG sets the pipeline emits. */
function picture(id: string, alt: string, sizes = '100vw', eager = false): string {
  // No section image renders wider than ~52vw, which is ~750 CSS px on a 1440
  // viewport - 1600 already covers that at 2x DPR. Larger derivatives were pure
  // repo and transfer weight, so the set stops here. The hero uses its own
  // art-directed plates and does go bigger.
  const w = [960, 1600]
  const set = (ext: string) => w.map(n => `img/${id}-${n}.${ext} ${n}w`).join(', ')
  // AVIF with a progressive-JPEG fallback. WebP sat between them buying almost
  // nothing: every browser that lacks AVIF support here is old enough that the
  // JPEG is the honest fallback, and carrying a third encoding of 16 frames cost
  // more repo weight than it saved any real visitor.
  return `<picture>
    <source type="image/avif" sizes="${sizes}" srcset="${set('avif')}">
    <img src="img/${id}-1600.jpg" srcset="${set('jpg')}" sizes="${sizes}" alt="${alt}"
         loading="${eager ? 'eager' : 'lazy'}" decoding="async">
  </picture>`
}

/* ------------------------------------------------------------------ gate */
const GATE_KEY = 'gss.age.v1'

/** True once the visitor has confirmed 21+, so the hemp section need not re-ask. */
let ageConfirmed = false

function initGate() {
  const gate = $('#gate')!
  const s1 = $('#gate-step-1')!, s2 = $('#gate-step-2')!
  const shell = $('#main')!, nav = $('#nav')!, footer = $('.footer')!

  const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'

  // Everything behind the gate is hidden from tab order and assistive tech while
  // it is open. Without this the skip link (and every nav link, CTA and card
  // underneath) is reachable by keyboard through an opaque overlay.
  const setBackground = (inert: boolean) => {
    for (const el of [shell, nav, footer]) {
      if (inert) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true') }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden') }
    }
  }

  const open = () => {
    gate.removeAttribute('hidden')
    document.body.classList.add('gate-locked')
    setBackground(true)
  }

  const pass = () => {
    ageConfirmed = true
    gate.classList.add('dismiss')
    document.body.classList.remove('gate-locked')
    setBackground(false)
    setTimeout(() => gate.setAttribute('hidden', ''), 950)
    $('#portal')?.classList.add('unlocked')
    // Return focus to the page rather than dropping it on <body>.
    shell.setAttribute('tabindex', '-1')
    shell.focus({ preventScroll: true })
    ScrollTrigger.refresh()
  }

  let remembered = false
  try { remembered = localStorage.getItem(GATE_KEY) === 'ok' } catch { /* private mode */ }
  if (remembered) {
    ageConfirmed = true
    gate.setAttribute('hidden', '')
    gate.classList.add('dismiss')
    document.body.classList.remove('gate-locked')
    setBackground(false)
    return
  }

  open()

  // --- the intro film --------------------------------------------------------
  const film = $<HTMLVideoElement>('#gate-film')

  // The `media` attribute only works on <source> inside <picture>, not <video> -
  // a landscape cut object-fit:cover'd into a 9:19.5 phone screen shows about a
  // quarter of the frame. So the orientation is chosen here instead, and the
  // sources are attached only once we know we are going to play them.
  //
  // MP4 first: H.264 is both smaller than our VP9 encode and universally
  // decodable. WebM is the fallback for the handful of builds without H.264.
  if (film) {
    const portrait = matchMedia('(max-aspect-ratio: 1/1)').matches
    const stem = portrait ? 'intro-portrait' : 'intro'
    film.poster = `video/${portrait ? 'intro-poster-portrait' : 'intro-poster'}.jpg`
    for (const [ext, type] of [['mp4', 'video/mp4'], ['webm', 'video/webm']] as const) {
      const s = document.createElement('source')
      s.src = `video/${stem}.${ext}`
      s.type = type
      film.appendChild(s)
    }
    film.load()
  }
  // Seven seconds of film before the buttons arrive is a long time to hold
  // someone who just wants the phone number. Any tap, click or key press skips
  // straight to the answerable state - the film is a gift, not a toll.
  const skip = () => {
    if (gate.classList.contains('instant')) return
    gate.classList.add('instant')
    if (film) { try { film.currentTime = Math.max(0, film.duration - 0.4) } catch {} }
  }
  gate.addEventListener('pointerdown', skip)
  gate.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') skip() })

  if (film && !reduced) {
    film.play().catch(() => {
      // Autoplay refused (low-power mode, data saver). The poster still carries
      // the frame, so drop straight to the readable state instead of stalling.
      gate.classList.add('instant')
    })
    // Hold the last frame rather than looping back into the ignition.
    film.addEventListener('ended', () => { gate.classList.add('instant') })
  } else {
    gate.classList.add('instant')
  }

  $('#gate-yes')!.addEventListener('click', () => {
    try { localStorage.setItem(GATE_KEY, 'ok') } catch {}
    pass()
  })
  // Moving focus with each step change; hiding the step the focused button lives
  // in would otherwise drop focus to <body> and strand the keyboard user.
  $('#gate-no')!.addEventListener('click', () => {
    s1.hidden = true; s2.hidden = false
    ;($('#gate-back') as HTMLElement).focus()
  })
  $('#gate-back')!.addEventListener('click', () => {
    s2.hidden = true; s1.hidden = false
    ;($('#gate-yes') as HTMLElement).focus()
  })

  gate.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // Escape must not grant entry. It steps back to the question.
      if (!s2.hidden) { s2.hidden = true; s1.hidden = false; ($('#gate-yes') as HTMLElement).focus() }
      e.preventDefault(); return
    }
    if (e.key !== 'Tab') return
    const items = $$<HTMLElement>(FOCUSABLE, gate).filter(el => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault() }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault() }
  })

  ;($('#gate-yes') as HTMLElement).focus()
}

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

/* ----------------------------------------------------------- categories */
const CATEGORIES = [
  { id: 'vapes',   img: 'IMG_6092', name: 'Disposable Vapes', count: () => `${catalog.vapes.length} brands`,        tint: 'rgba(255,138,30,.28)' },
  { id: 'pouches', img: 'IMG_6083', name: 'Nicotine Pouches', count: () => `${catalog.pouches.length} flavors`,     tint: 'rgba(46,107,255,.3)' },
  { id: 'glass',   img: 'IMG_6078', name: 'Glass & Water Pipes', count: () => `${catalog.glass.count} pieces`,      tint: 'rgba(53,255,122,.24)' },
  { id: 'cigars',  img: 'IMG_6090', name: 'Cigars & Humidor', count: () => `${catalog.cigars.length} houses`,       tint: 'rgba(255,194,77,.28)' },
  { id: 'papers',  img: 'IMG_6084', name: 'Papers & Wraps',   count: () => `${catalog.papers.length} brands`,       tint: 'rgba(255,45,155,.24)' },
  { id: 'hookah',  img: 'IMG_6081', name: 'Hookah',           count: () => `${catalog.hookah.count} on the shelf`,  tint: 'rgba(46,107,255,.24)' },
  { id: 'accessories', img: 'IMG_6087', name: 'Grinders & Torches', count: () => `${catalog.accessories.length} brands`, tint: 'rgba(255,138,30,.22)' },
  { id: 'hemp',    img: 'IMG_6094', name: 'Hemp Room · 21+',  count: () => 'Behind the counter',                    tint: 'rgba(53,255,122,.26)' },
]

function initCategories() {
  const el = $('#cat-grid'); if (!el) return
  el.innerHTML = CATEGORIES.map(c => `
    <a class="cat reveal" href="#${c.id}" aria-label="${c.name}">
      ${picture(c.img, c.name, '(max-width:560px) 100vw, (max-width:1080px) 50vw, 25vw')}
      <span class="cat-glow" style="background:radial-gradient(90% 70% at 50% 100%, ${c.tint}, transparent 70%)"></span>
      <span class="cat-body">
        <span class="cat-name">${c.name}</span>
        <span class="cat-count">${c.count()}</span>
      </span>
    </a>`).join('')
}

/* --------------------------------------------------------------- photos */
function initSectionPhotos() {
  $$('[data-img]').forEach(fig => {
    const id = fig.getAttribute('data-img')!
    const alt = fig.getAttribute('data-alt') || ''
    fig.insertAdjacentHTML('afterbegin', picture(id, alt, '(max-width:940px) 100vw, 52vw'))
  })
}

/* ---------------------------------------------------------- vape brands */
function initVapes() {
  const list = $('#vape-brands'), detail = $('#vape-detail')
  if (!list || !detail) return

  list.innerHTML = catalog.vapes.map(v => `
    <button class="brand-chip ${v.hero ? 'is-hero' : ''}" data-brand="${v.id}"
            aria-expanded="false" aria-controls="vape-detail">
      ${v.hero ? '<span class="star">★</span>' : ''}${v.brand}
    </button>`).join('')

  const hw = $('#hardware-brands')
  if (hw) hw.innerHTML = catalog.hardware.map(h => `<span class="brand-chip">${h.brand}</span>`).join('')

  const show = (id: string) => {
    const v = catalog.vapes.find(x => x.id === id)!
    detail.innerHTML = `
      <h3>${v.brand}</h3>
      ${v.lines.length
        ? `<div class="lines">${v.lines.map(l => `<span>${l}</span>`).join('')}</div>`
        : `<p class="ask" style="border:0;padding:0;margin-top:10px">Multiple lines and flavors in stock.</p>`}
      <p class="ask">Flavors rotate constantly and we don't publish prices online — call the shop or come in and we'll tell you exactly what's on the wall today.</p>`
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
const MODELS = [
  { id: 'caliburn-blue', name: 'Uwell Caliburn G2', finish: 'Blue', hex: '#2C5FD6' },
  { id: 'caliburn-red',  name: 'Uwell Caliburn G2', finish: 'Red',  hex: '#C0272D' },
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
        alt="A 3D model of a Uwell Caliburn G2 pod device sold at Glen Smoke Shop"
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

function initPouches() {
  const grid = $('#pouch-grid'), filters = $('#pouch-filters')
  if (!grid || !filters) return

  const cnt = $('#pouch-count'); if (cnt) cnt.textContent = String(catalog.pouches.length)

  grid.innerHTML = catalog.pouches.map(p => {
    const c = tintFor(p.flavor)
    const strengths = p.strengths.length ? p.strengths.map(s => `${s}mg`).join(' · ') : 'Ask in store'
    return `<div class="puck" style="color:${c}"
                 data-brand="${p.brand}" data-strengths="${p.strengths.join(',')}">
      <span class="b">${p.brand}</span>
      <span class="f">${p.flavor}</span>
      <span class="s">${strengths}</span>
    </div>`
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

/* ---------------------------------------------------------------- glass */
const COLOR_HEX: Record<string, string> = {
  clear: '#DDE6F0', cobalt: '#1E4FD8', 'royal blue': '#2E6BFF', jade: '#2FA980',
  'kelly green': '#3CB44B', amber: '#D98A2B', gold: '#C9A227', 'gold fume': '#C9A227',
  iridescent: '#8E7BE0', 'oil slick': '#6A5ACD', maroon: '#7B1F3A', coral: '#F4796B',
  'blush pink': '#F2A0BE', lavender: '#B79CE8', rasta: '#3CB44B', white: '#EDEDED',
  black: '#222833', purple: '#7C4DFF', teal: '#1FA8A0', pink: '#FF6FAE',
}
function initGlass() {
  const stats = $('#glass-stats')
  if (stats) {
    stats.innerHTML = [
      { n: catalog.glass.count, l: 'Pieces on display' },
      { n: '150+', l: 'Hand pipes & chillums' },
      { n: catalog.hookah.count, l: 'Hookahs' },
    ].map(s => `<div class="gstat"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('')
  }

  const cols = $('#glass-colors')
  if (cols) {
    const seen = new Set<string>()
    const swatches = (catalog.glass.colors as string[]).flatMap(raw => {
      const key = Object.keys(COLOR_HEX).find(k => raw.toLowerCase().includes(k))
      if (!key || seen.has(key)) return []
      seen.add(key)
      return [`<span class="swatch"><i style="background:${COLOR_HEX[key]}"></i>${key.replace(/\b\w/g, m => m.toUpperCase())}</span>`]
    })
    cols.innerHTML = swatches.join('')
  }
}

/* ----------------------------------------------------- cigars & brands */
function initLists() {
  // Cigars had their own render path and stayed fully expanded: 30 names inline.
  const cigarList = (sel: string, arr: { brand: string }[], shown: number) => {
    const el = $(sel); if (!el) return
    const head = arr.slice(0, shown), rest = arr.slice(shown)
    el.innerHTML =
      head.map(c => `<span class="cigar-name">${c.brand}</span>`).join('') +
      (rest.length
        ? `<span class="brand-more" hidden>${rest.map(c => `<span class="cigar-name">${c.brand}</span>`).join('')}</span>
           <button class="cigar-name is-more" aria-expanded="false">+${rest.length} more</button>`
        : '')
    const btn = $('button.is-more', el)
    btn?.addEventListener('click', () => {
      const more = $('.brand-more', el)!
      const open = btn.getAttribute('aria-expanded') === 'true'
      more.hidden = open
      btn.setAttribute('aria-expanded', String(!open))
      btn.textContent = open ? `+${rest.length} more` : 'Show fewer'
      ScrollTrigger.refresh()
    })
  }
  cigarList('#cigars-premium', catalog.cigars.filter(c => c.premium), 8)
  cigarList('#cigars-value', catalog.cigars.filter(c => !c.premium), 6)

  // Six visible, the rest behind a disclosure. Rendering all 194 brand names
  // inline made the phone page roughly 6,000px of text nobody reads standing in
  // a parking lot - but the names still need to be in the DOM for search.
  const chips = (sel: string, arr: { brand: string }[], shown = 6) => {
    const el = $(sel); if (!el) return
    const head = arr.slice(0, shown), rest = arr.slice(shown)
    el.innerHTML =
      head.map(a => `<span class="brand-chip">${a.brand}</span>`).join('') +
      (rest.length
        ? `<span class="brand-more" hidden>${rest.map(a => `<span class="brand-chip">${a.brand}</span>`).join('')}</span>
           <button class="brand-chip is-more" aria-expanded="false">+${rest.length} more</button>`
        : '')
    const btn = $('button.is-more', el)
    btn?.addEventListener('click', () => {
      const more = $('.brand-more', el)!
      const open = btn.getAttribute('aria-expanded') === 'true'
      more.hidden = open
      btn.setAttribute('aria-expanded', String(!open))
      btn.textContent = open ? `+${rest.length} more` : 'Show fewer'
      ScrollTrigger.refresh()
    })
  }
  chips('#paper-brands', catalog.papers)
  chips('#accessory-brands', catalog.accessories)
  chips('#kratom-brands', catalog.kratom)
}

/* ----------------------------------------------------------- hemp gate */
function initPortal() {
  const portal = $('#portal'), forms = $('#hemp-forms')
  if (!portal || !forms) return
  forms.innerHTML = catalog.hemp_forms
    .map(f => `<div class="form-tile"><div class="n">${f.name}</div><div class="d">${f.note}</div></div>`).join('')
  // The visitor already confirmed 21+ at the door. Re-asking is friction, not
  // compliance - the gate is the control, this is just the section it protects.
  if (ageConfirmed) portal.classList.add('unlocked')
  $('#portal-unlock')!.addEventListener('click', () => {
    portal.classList.add('unlocked')
    ScrollTrigger.refresh()
  })
}

/* -------------------------------------------------------------- gallery */
const TOUR = [
  { id: 'IMG_6079', cls: 'w4', alt: 'Wide view of the sales floor, shelves and cases on every wall' },
  { id: 'IMG_6080', cls: 'w2', alt: 'Product shelving and centre display at Glen Smoke Shop' },
  { id: 'IMG_6074', cls: 'w2', alt: 'A stocked shelf bay of vapes, wraps and accessories' },
  { id: 'IMG_6077', cls: 'w2', alt: 'Lit glass case filled with hand-blown water pipes' },
  { id: 'IMG_6089', cls: 'w2', alt: 'Cedar humidor shelves lined with cigars' },
  { id: 'IMG_6093', cls: 'w3', alt: 'Aisle of disposable vapes stretching to the back of the store' },
  { id: 'IMG_6070', cls: 'w3', alt: 'Glen Smoke Shop storefront lit up at night' },
]
function initGallery() {
  const el = $('#gallery'); if (!el) return
  el.innerHTML = TOUR.map(t =>
    `<figure class="${t.cls}">${picture(t.id, t.alt, '(max-width:860px) 100vw, 50vw')}</figure>`).join('')
}

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

  const half = Math.ceil(list.length / 2)
  const rowA = list.slice(0, half), rowB = list.slice(half).length ? list.slice(half) : list
  const row = (rs: Review[], cls: string) =>
    `<div class="rev-row ${cls}">${rs.map(card).join('')}${rs.map(card).join('')}</div>`
  host.innerHTML = row(rowA, 'a') + row(rowB, 'b')
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
      el.textContent = '0' + suffix
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to({ v: 0 }, {
          v: target, duration: 1.5, ease: 'power2.out',
          onUpdate() { el.textContent = Math.round((this.targets()[0] as any).v) + suffix },
        }),
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

  // Nav active-section tracking.
  const links = $$<HTMLAnchorElement>('.nav-links a')
  links.forEach(a => {
    const id = a.getAttribute('href')!
    const sec = $(id)
    if (!sec) return
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: self => { if (self.isActive) links.forEach(l => l.classList.toggle('active', l === a)) },
    })
  })
}

/* --------------------------------------------------------------- boot */
function boot() {
  initGate()
  initContact()
  initHours()
  initTicker()
  initHeroStats()
  initCategories()
  initSectionPhotos()
  initVapes()
  init3D()
  initPouches()
  initGlass()
  initLists()
  initPortal()
  initGallery()
  initReviews()
  initMap()
  initMotion()
  setInterval(initHours, 60_000)   // keep open/closed honest without a reload
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot()
