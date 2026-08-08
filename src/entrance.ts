/* ==========================================================================
   Entrance — the 21+ gate, staged as walking into the shop

   Replaces the pre-rendered intro film. The film was 4.4MB and could not
   begin until it downloaded; this drives the storefront plate the page is
   already fetching for its hero, so the first frame is whatever the browser
   has decoded and there is no stall to disguise.

   Sequence:
     black storefront -> neon strikes (uneven, with false starts)
     -> colour race   -> question resolves out of the glow
     -> "Yes, I'm 21+" splits the doors and you walk in

   Everything here degrades. No JS: statically lit gate (see entrance.css).
   Reduced motion: lit, no strike, no doors. Skipped: jumps to lit.
   ========================================================================== */

const AGE_KEY = 'gss.age.v1'
const SEEN_KEY = 'gss.entered.v1'

const STRIKE_MS = 1700
const DOORS_MS = 1250

export interface EntranceHandles {
  /** Called once the visitor is through — after the doors, not before. */
  onPass: () => void
  /** Called the instant 21+ is confirmed, before the animation finishes. */
  onConfirm?: () => void
}

const q = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector(s) as T | null

const qq = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll(s)) as T[]

export function initEntrance({ onPass, onConfirm }: EntranceHandles): boolean {
  const gate = q('#gate')
  if (!gate) return true

  const s1 = q('#gate-step-1')!
  const s2 = q('#gate-step-2')!
  const shell = q('#main')!
  const nav = q('#nav')!
  const footer = q('.footer')

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'

  // Everything behind the gate leaves the tab order and the accessibility tree
  // while it is open. Without this the skip link, every nav link and every CTA
  // underneath stays reachable by keyboard through an opaque overlay.
  const setBackground = (inert: boolean) => {
    for (const el of [shell, nav, footer]) {
      if (!el) continue
      if (inert) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true') }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden') }
    }
  }

  const release = () => {
    gate.setAttribute('hidden', '')
    document.body.classList.remove('gate-locked')
    setBackground(false)
  }

  // --- already 21+ on a previous visit -------------------------------------
  let remembered = false
  try { remembered = localStorage.getItem(AGE_KEY) === 'ok' } catch { /* private mode */ }
  if (remembered) {
    gate.classList.add('lit', 'instant')
    release()
    return true
  }

  gate.removeAttribute('hidden')
  document.body.classList.add('gate-locked')
  setBackground(true)

  // --- ignition -------------------------------------------------------------
  let settled = false

  /** Jump to the lit state, cancelling whatever is mid-flight. */
  const settle = () => {
    if (settled) return
    settled = true
    gate.classList.remove('lighting')
    gate.classList.add('lit')
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch {}
  }

  let seen = false
  try { seen = sessionStorage.getItem(SEEN_KEY) === '1' } catch {}

  if (reduced || seen) {
    // Reduced motion gets no light show. A repeat view within the same session
    // (they hit No and came back, or reloaded) does not get made to watch the
    // tubes strike a second time — that is when a flourish turns into a toll.
    gate.classList.add('instant')
    settle()
  } else {
    gate.classList.add('lighting')
    setTimeout(settle, STRIKE_MS)
  }

  // Any input at all skips ahead. The entrance is a gift, not a gate within
  // the gate; someone who just wants the phone number should never wait.
  const skip = () => settle()
  gate.addEventListener('pointerdown', skip, { passive: true })
  gate.addEventListener('keydown', e => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') skip()
  })

  // --- walking in -----------------------------------------------------------
  let opening = false

  const enter = () => {
    if (opening) return
    opening = true
    try { localStorage.setItem(AGE_KEY, 'ok') } catch {}
    onConfirm?.()

    settle()
    gate.classList.add('opening')
    document.body.classList.remove('gate-locked')
    setBackground(false)

    // Hand focus to the page rather than dropping it on <body>.
    shell.setAttribute('tabindex', '-1')
    shell.focus({ preventScroll: true })

    const finish = () => {
      gate.setAttribute('hidden', '')
      onPass()
    }
    if (reduced) setTimeout(finish, 320)
    else setTimeout(finish, DOORS_MS)
  }

  q('#gate-yes')!.addEventListener('click', enter)

  // Moving focus with each step change: hiding the step the focused button
  // lives in would otherwise drop focus to <body> and strand the keyboard user.
  q('#gate-no')!.addEventListener('click', () => {
    s1.hidden = true; s2.hidden = false
    ;(q('#gate-back') as HTMLElement).focus()
  })
  q('#gate-back')!.addEventListener('click', () => {
    s2.hidden = true; s1.hidden = false
    ;(q('#gate-yes') as HTMLElement).focus()
  })

  gate.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // Escape must never grant entry. It steps back to the question.
      if (!s2.hidden) {
        s2.hidden = true; s1.hidden = false
        ;(q('#gate-yes') as HTMLElement).focus()
      }
      e.preventDefault()
      return
    }
    if (e.key !== 'Tab') return
    const items = qq<HTMLElement>(FOCUSABLE, gate).filter(el => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault() }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault() }
  })

  ;(q('#gate-yes') as HTMLElement).focus()
  return false
}
