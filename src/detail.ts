/* ==========================================================================
   Product detail sheet

   Tapping a brand, a flavour or a piece opens a panel with its photo, a real
   description and its spec chips. This is the part of the site that does the
   selling — the shop's whole advantage is that someone behind the counter
   knows the difference between two devices, and this is that conversation
   written down.

   Deliberate choices:
   - It is a <dialog>, so the browser gives us the top layer, the backdrop,
     Escape handling and focus containment instead of us reimplementing them.
   - The URL gets a hash while it is open, so a customer can be sent straight
     to one product. Closing restores the URL without adding history entries.
   - Focus returns to the element that opened it. Losing your place in a grid
     of 31 flavours because a panel closed is the kind of thing that only ever
     happens to keyboard users, which is exactly why it has to be handled.
   ========================================================================== */

import descriptions from './data/descriptions.json'
import shelfData from './data/shelf.json'

export interface Entry {
  id: string
  name: string
  kind?: string
  blurb?: string
  body: string
  notes?: string[]
  confidence?: string
}

type Extra = {
  /** Optional image stem, e.g. "img/pouch/zyn-chill" — 160/320 variants assumed. */
  shot?: string
  /** Overrides the entry's own name, e.g. to include the brand. */
  title?: string
  /** Small line under the title: strengths, sizes, whatever the item has. */
  meta?: string
}

const BY_ID = new Map<string, Entry>(
  (descriptions as { entries: Entry[] }).entries.map(e => [e.id, e])
)

/* What we photographed on this brand's shelf, keyed by catalog id. The vapes
   page renders this inline under the brand chips; every other section only has
   the sheet, so the sheet has to carry it too or the papers, cigar, hookah and
   gear reads are invisible. */
type ShelfItem = { id: string; name: string; legibility: string }
type ShelfBrand = { brand: string; count: number; lines: Record<string, ShelfItem[]> }

const SHELF = new Map<string, ShelfBrand>()
for (const b of Object.values((shelfData as any).brands as Record<string, any>)) {
  if (b.catalogId) SHELF.set(b.catalogId, b)
}

function shelfBlock(id: string): string {
  const b = SHELF.get(id)
  if (!b) return ''
  const lines = Object.entries(b.lines)
  return `
    <div class="sheet-shelf">
      <p class="sheet-shelf-head"><strong>${b.count}</strong> on our shelf</p>
      ${lines.map(([line, items]) => `
        <div class="shelf-line">
          ${line !== '\u2014' ? `<p class="shelf-line-name">${line}</p>` : ''}
          <ul class="flav-list">${items.map(i =>
            `<li class="flav${i.legibility !== 'clear' ? ' is-soft' : ''}">${i.name}</li>`).join('')}</ul>
        </div>`).join('')}
    </div>`
}

/** Everything we know about an item, or null if we have nothing honest to say. */
export const describe = (id: string): Entry | null => BY_ID.get(id) || null

let dialog: HTMLDialogElement | null = null
let opener: HTMLElement | null = null

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog
  dialog = document.createElement('dialog')
  dialog.className = 'sheet'
  dialog.innerHTML = `
    <button class="sheet-close" type="button" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <div class="sheet-body" tabindex="-1"></div>`
  document.body.appendChild(dialog)

  dialog.querySelector('.sheet-close')!.addEventListener('click', () => close())

  // Clicking the backdrop closes. `dialog` reports backdrop clicks as clicks on
  // the dialog element itself, so compare against the content box.
  dialog.addEventListener('click', e => {
    const r = dialog!.getBoundingClientRect()
    const { clientX: x, clientY: y } = e as MouseEvent
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) close()
  })

  dialog.addEventListener('close', () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
    opener?.focus()
    opener = null
  })

  return dialog
}

export function close() {
  dialog?.close()
}

export function open(id: string, extra: Extra = {}, from?: HTMLElement) {
  const entry = describe(id)
  if (!entry) return false

  const d = ensureDialog()
  opener = from || (document.activeElement as HTMLElement)

  const title = extra.title || entry.name
  const shot = extra.shot
    ? `<div class="sheet-shot">
         <picture>
           <source type="image/avif" srcset="${extra.shot}-320.avif">
           <img src="${extra.shot}-320.jpg" alt="${title}" width="320" height="320" decoding="async">
         </picture>
       </div>`
    : ''

  const notes = entry.notes?.length
    ? `<ul class="sheet-notes">${entry.notes.map(n => `<li>${n}</li>`).join('')}</ul>`
    : ''

  // "likely" means the writer could not fully verify the line against a current
  // manufacturer source. Saying so is cheaper than being wrong in front of a
  // customer who knows the product better than we do.
  const hedge = entry.confidence === 'likely'
    ? `<p class="sheet-hedge">Lines rotate — ask us what's actually on the shelf today.</p>`
    : ''

  d.querySelector('.sheet-body')!.innerHTML = `
    ${shot}
    <div class="sheet-copy">
      <h2 class="sheet-title">${title}</h2>
      ${extra.meta ? `<p class="sheet-meta">${extra.meta}</p>` : ''}
      ${entry.blurb ? `<p class="sheet-blurb">${entry.blurb}</p>` : ''}
      <p class="sheet-text">${entry.body}</p>
      ${notes}
      ${shelfBlock(id)}
      ${hedge}
      <div class="sheet-actions">
        <a class="btn btn-call" data-call href="tel:+13315510005">Call about this</a>
        <a class="btn btn-text" data-sms href="tel:+13315510005">Text us</a>
      </div>
    </div>`

  d.showModal()
  ;(d.querySelector('.sheet-body') as HTMLElement).focus({ preventScroll: true })
  history.replaceState(null, '', `#${id}`)
  return true
}

/**
 * Wire a container so any descendant carrying `data-detail` opens its sheet.
 * Delegated, so grids can re-render without rebinding.
 */
export function bind(root: ParentNode, resolve?: (el: HTMLElement) => Extra) {
  root.addEventListener('click', e => {
    const el = (e.target as Element)?.closest?.('[data-detail]') as HTMLElement | null
    if (!el) return
    const id = el.getAttribute('data-detail')!
    if (open(id, resolve ? resolve(el) : {}, el)) e.preventDefault()
  })
}

/** Open whatever the URL points at, once, on load. */
export function openFromHash(resolve?: (id: string) => Extra) {
  const id = location.hash.slice(1)
  if (!id) return
  if (!describe(id)) return
  open(id, resolve ? resolve(id) : {})
}
