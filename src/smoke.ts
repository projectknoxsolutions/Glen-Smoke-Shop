/* ==========================================================================
   Smoke

   The entrance sits in haze. Confirming 21+ blows it off the screen and the
   shop is behind it.

   Why this is drawn rather than played:

   A video with a real alpha channel does not survive the browser matrix —
   VP9-with-alpha in WebM is Chrome/Firefox only, HEVC-with-alpha is Safari
   only, and shipping both is two encodes of a full-screen effect for something
   that plays once. A pre-rendered smoke sprite sheet is worse: at any size big
   enough to fill a desktop viewport it outweighs every other asset on the page
   combined.

   So: three puff textures generated once at runtime from value noise, then
   drawn forty-odd times with independent drift, rotation, scale and alpha.
   Total download cost is zero bytes. Total generation cost is about 4ms on a
   phone, done once, off the critical path.

   The look it is going for is a slow warm haze lit from behind by the sign —
   not a cartoon puff and not a fog machine. Smoke in still air barely moves;
   the drift here is deliberately lazy. Then the gust hits.
   ========================================================================== */

export interface SmokeHandle {
  /** Blow the smoke off screen. Resolves when the last puff has left. */
  clear: () => Promise<void>
  /** Tear down the canvas and stop the loop. */
  destroy: () => void
}

interface Puff {
  x: number
  y: number
  /** radius in CSS px */
  r: number
  a: number
  rot: number
  spin: number
  vx: number
  vy: number
  tex: number
  /** per-puff phase so the breathing does not sync up */
  ph: number
  /** how much of the gust this puff catches — front puffs go first */
  gust: number
}

/* -------------------------------------------------------------- textures -- */

/** Cheap value noise, smoothed. Good enough for something this diffuse. */
function noiseField(size: number, cells: number): Float32Array {
  const g = new Float32Array((cells + 1) * (cells + 1))
  for (let i = 0; i < g.length; i++) g[i] = Math.random()

  const out = new Float32Array(size * size)
  const step = cells / size
  const smooth = (t: number) => t * t * (3 - 2 * t)

  for (let y = 0; y < size; y++) {
    const fy = y * step
    const y0 = Math.floor(fy)
    const ty = smooth(fy - y0)
    for (let x = 0; x < size; x++) {
      const fx = x * step
      const x0 = Math.floor(fx)
      const tx = smooth(fx - x0)
      const i = y0 * (cells + 1) + x0
      const a = g[i], b = g[i + 1], c = g[i + cells + 1], d = g[i + cells + 2]
      out[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    }
  }
  return out
}

/**
 * One puff: a soft disc whose alpha is chewed away by a couple of octaves of
 * noise, so the edge is ragged the way smoke is rather than a clean vignette.
 */
function makePuff(size: number, seedCells: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const d = img.data

  const n1 = noiseField(size, seedCells)
  const n2 = noiseField(size, seedCells * 2)
  const n3 = noiseField(size, seedCells * 4)

  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const dx = (x - c) / c
      const dy = (y - c) / c
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Radial falloff, then bitten into by noise.
      let a = Math.max(0, 1 - dist)
      a = a * a * (3 - 2 * a)

      const fbm = n1[i] * 0.55 + n2[i] * 0.3 + n3[i] * 0.15
      a *= 0.35 + fbm * 0.95
      a = Math.max(0, Math.min(1, a))
      a *= a

      const o = i * 4
      // Slightly warm grey: smoke under sodium and neon is never neutral.
      const lift = fbm * 26
      d[o] = 214 + lift * 0.3
      d[o + 1] = 208 + lift * 0.2
      d[o + 2] = 202 + lift * 0.1
      d[o + 3] = a * 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

/* ------------------------------------------------------------------ init -- */

export function initSmoke(host: HTMLElement, opts: { density?: number } = {}): SmokeHandle {
  const cv = document.createElement('canvas')
  cv.className = 'smoke-canvas'
  cv.setAttribute('aria-hidden', 'true')
  host.appendChild(cv)

  const ctx = cv.getContext('2d', { alpha: true })!
  // Smoke is the softest thing on screen — there is nothing here that rewards
  // rendering at 3x on a phone, and the fill rate very much does not.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6)

  let w = 0
  let h = 0
  const resize = () => {
    w = host.clientWidth || window.innerWidth
    h = host.clientHeight || window.innerHeight
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    cv.style.width = w + 'px'
    cv.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  addEventListener('resize', resize)

  const TEX = [makePuff(256, 4), makePuff(256, 6), makePuff(256, 3)]

  // Enough to read as a wall of haze, few enough that a mid-range phone holds
  // 60fps. Scaled by area so a desktop does not look sparse.
  const density = opts.density ?? 1
  // Fewer, more varied puffs. At 78 near-identical 480px blobs the field
  // averaged out into a flat grey lift — technically 100% coverage and visually
  // nothing. Smoke reads as smoke because of the gaps.
  const COUNT = Math.round(Math.min(52, Math.max(26, (w * h) / 24000)) * density)

  const puffs: Puff[] = []
  for (let i = 0; i < COUNT; i++) {
    const y = Math.random()
    puffs.push({
      x: Math.random() * w,
      y: y * h,
      // Wide size spread on purpose: a few big soft banks for mass, plenty of
      // small tight ones for the structure your eye actually reads as smoke.
      r: h * (0.07 + Math.pow(Math.random(), 1.7) * 0.38),
      a: 0.32 + Math.random() * 0.42,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.00016,
      vx: (Math.random() - 0.3) * 0.016,
      vy: -0.012 - Math.random() * 0.020,
      tex: i % TEX.length,
      ph: Math.random() * Math.PI * 2,
      // Puffs low and left catch the gust first, so the screen clears as a
      // sweep instead of everything sliding at once.
      gust: 0.65 + (1 - y) * 0.5 + Math.random() * 0.35,
    })
  }

  let raf = 0
  let last = 0
  let blowing = 0          // 0 = idle, otherwise ms since the gust started
  let dead = false
  let onDone: (() => void) | null = null

  const BLOW_MS = 1550

  const frame = (t: number) => {
    if (dead) return
    const dt = last ? Math.min(48, t - last) : 16
    last = t

    ctx.clearRect(0, 0, w, h)

    let alive = 0
    for (const p of puffs) {
      if (blowing) {
        const k = Math.min(1, blowing / BLOW_MS)
        // Ease in: the gust arrives, it does not start at full speed.
        // Cubic rather than smoothstep: the first third of the gust is almost
        // still, so you register the smoke before it goes. Ramping linearly
        // read as a wipe.
        const push = k * k * k * p.gust
        p.x += push * dt * 2.6
        p.y -= push * dt * 0.5
        p.r += push * dt * 0.62
        p.rot += p.spin * dt * 6
        p.a *= 1 - 0.0016 * dt
      } else {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.spin * dt
        // Breathe, so a still frame never looks like a still frame.
        // Visible roll rather than a static veil: without this the field
        // averages into a flat lift and stops reading as smoke at all.
        p.r += Math.sin(t * 0.0006 + p.ph) * 0.05 * dt
        p.x += Math.sin(t * 0.00022 + p.ph * 1.7) * 0.02 * dt
        if (p.y + p.r < -h * 0.15) {
          p.y = h + p.r * 0.6
          p.x = Math.random() * w
        }
      }

      if (p.a < 0.004 || p.x - p.r > w * 1.6) continue
      alive++

      // Heavier low in the frame, thinner up top — it is rising, and it keeps
      // the sign readable through it rather than veiling the one thing the
      // entrance exists to show.
      const height = 1 - Math.max(0, Math.min(1, p.y / h))
      const fade = 0.62 + (1 - height) * 0.62

      const s = p.r * 2
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, p.a * fade))
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.drawImage(TEX[p.tex], -s / 2, -s / 2, s, s)
      ctx.restore()
    }

    if (blowing) {
      blowing += dt
      if (!alive || blowing > BLOW_MS + 900) {
        ctx.clearRect(0, 0, w, h)
        dead = true
        onDone?.()
        return
      }
    }

    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    clear() {
      return new Promise<void>(resolve => {
        if (dead) return resolve()
        blowing = 1
        onDone = resolve
        // Never leave the caller hanging on a tab that got backgrounded
        // mid-gust: rAF stops, the promise would never settle, and the gate
        // would stay up forever.
        setTimeout(() => { if (!dead) { dead = true; resolve() } }, BLOW_MS + 1400)
      })
    },
    destroy() {
      dead = true
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      cv.remove()
    },
  }
}
