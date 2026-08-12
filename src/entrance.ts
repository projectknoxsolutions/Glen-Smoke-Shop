/* ==========================================================================
   Entrance — walking into the shop

   This used to be a 21+ age gate. The owner does not want a challenge on the
   way in, so the question, the two buttons and the refusal step are gone. What
   is left is the part worth keeping: the storefront in the dark, the neon
   striking, haze rolling through it, and the doors parting. It blocks nothing.
   It dismisses itself, and any input at all dismisses it sooner.

   The site still asks on the 21+ Room page, which is the one shelf that
   warrants it. That confirmation lives in room21 and is unaffected by this.

   It drives the storefront plate the page is already fetching for its hero, so
   the first frame is whatever the browser has decoded and there is no stall to
   disguise. The version before that was a 4.4MB pre-rendered film that could
   not begin until it downloaded.

   Sequence:
     black storefront -> neon strikes (uneven, with false starts)
     -> colour race   -> haze rolls in -> doors part, and you are inside

   Everything degrades. No JS: the gate is statically lit and CSS-hidden, so a
   crawler and a scripting-disabled browser both get the page, not a black
   screen. Reduced motion: lit, no strike, no doors, out almost immediately.
   ========================================================================== */

import { initSmoke, type SmokeHandle } from './smoke'

const SEEN_KEY = 'gss.entered.v1'

const STRIKE_MS = 1700
/** How long the lit storefront holds before the doors open on their own. */
const HOLD_MS = 1150
const CLEAR_MS = 1250

export interface EntranceHandles {
  /** Called once the visitor is through — after the doors, not before. */
  onPass: () => void
  /** Kept for the caller's convenience; fires as the doors start to move. */
  onConfirm?: () => void
}

const q = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector(s) as T | null

export function initEntrance({ onPass, onConfirm }: EntranceHandles): boolean {
  const gate = q('#gate')
  if (!gate) return true

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const release = () => {
    gate.setAttribute('hidden', '')
    document.body.classList.remove('gate-locked')
  }

  // --- once per session, not once per page ----------------------------------
  // The owner wants the entrance on arrival, every visit — it is the site's
  // opening shot, not a toll — so nothing is remembered across visits. But it
  // must NOT re-run on internal navigation, or all nine pages would replay it
  // on every click. sessionStorage covers exactly that, and closing the tab
  // resets it.
  let sameSession = false
  try { sameSession = sessionStorage.getItem(SEEN_KEY) === '1' } catch { /* private mode */ }
  if (sameSession) {
    gate.classList.add('lit', 'instant')
    release()
    return true
  }

  gate.removeAttribute('hidden')
  document.body.classList.add('gate-locked')

  // --- haze -----------------------------------------------------------------
  // Drawn, not filmed — see smoke.ts. Reduced motion gets none of it: a
  // full-screen particle field is exactly what that preference is asking us
  // not to do.
  //
  // Mounted on the GATE, not on .ent-scene. It lived inside the scene at first,
  // which put it underneath .gate-scrim — a radial wash of rgba(5,6,10,.55)
  // rising to .9 at the corners, there to keep the wordmark readable over the
  // storefront photo. The particles were drawing correctly the whole time
  // (measured: 25% mean coverage, 75% peak) and the scrim was quietly
  // multiplying all of it down to nothing.
  let smoke: SmokeHandle | null = null
  if (!reduced) {
    try { smoke = initSmoke(gate as HTMLElement) } catch { smoke = null }
  }

  // --- ignition -------------------------------------------------------------
  let settled = false
  let openTimer = 0

  /** Jump to the lit state, cancelling whatever is mid-flight. */
  const settle = () => {
    if (settled) return
    settled = true
    gate.classList.remove('lighting')
    gate.classList.add('lit')
  }

  if (reduced) {
    gate.classList.add('instant')
    settle()
  } else {
    gate.classList.add('lighting')
    setTimeout(settle, STRIKE_MS)
  }

  // --- walking in -----------------------------------------------------------
  let opening = false

  const enter = () => {
    if (opening) return
    opening = true
    clearTimeout(openTimer)
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch {}
    onConfirm?.()

    settle()
    gate.classList.add('opening')
    document.body.classList.remove('gate-locked')

    const finish = () => {
      gate.setAttribute('hidden', '')
      smoke?.destroy()
      onPass()
    }

    if (reduced || !smoke) {
      setTimeout(finish, reduced ? 220 : CLEAR_MS)
    } else {
      // The storefront and the wordmark fade while the gust is still running,
      // so what you watch is the smoke leaving — not a crossfade that happens
      // to have smoke in it.
      smoke.clear().then(finish)
    }
  }

  // It opens on its own. Nobody has to do anything, and nobody is asked
  // anything — which is the whole point of this rewrite.
  openTimer = window.setTimeout(enter, reduced ? 260 : STRIKE_MS + HOLD_MS)

  // Any input at all goes straight in. Someone who just wants the phone number
  // should never wait out an animation, and a keyboard user must not have to
  // find a control that no longer exists.
  const skip = () => enter()
  gate.addEventListener('pointerdown', skip, { passive: true })
  addEventListener('keydown', skip, { passive: true, once: true })
  addEventListener('wheel', skip, { passive: true, once: true })

  // Nothing behind the gate is inert any more and there is no focus trap: there
  // is nothing to focus inside it, and it is leaving in about a second and a
  // half whatever happens. Trapping focus in a decoration is how you strand a
  // keyboard user in a curtain.
  //
  // The return value used to mean "the visitor confirmed 21+". There is no
  // confirmation now, so it always reports true: nothing here gates anything.
  return true
}
