/* ==========================================================================
   Smoke — a volume, not a wallpaper

   The first version drew flat puffs at fixed sizes across a 2D field. It read
   as texture rather than as smoke, because smoke reads as smoke through DEPTH:
   near billows move fast and blur past you, far ones creep, and the light in
   the room falls off through the volume.

   So this one is a real (if small) 3D particle system:

     - every puff has a z, and is perspective-projected, so scale and parallax
       come out of the maths rather than being faked per-layer;
     - draw order is back-to-front by z, so overlap looks like depth;
     - each puff is lit by the sign — a warm key low and centre — and the light
       falls off with distance, so the bank nearest the sign glows and the ones
       at the back sit in shadow;
     - the gust is a 3D wind: puffs accelerate away from the camera and to the
       right, and the near ones leave first because they catch more of it.

   Still zero download: three puff textures generated once from value noise.
   Still plain alpha compositing — no mix-blend-mode, which is what made the
   entrance composite to black on a GPU-accelerated browser (see entrance.css).

   Budget: ~60 quads a frame at up to 1.6x DPR. That is nothing for a GPU and
   fine on a mid-range phone; the expensive part is fill rate, so the puffs are
   capped in screen size rather than in count.
   ========================================================================== */

export interface SmokeHandle {
  /** Blow it off screen. Resolves when the volume has cleared. */
  clear: () => Promise<void>
  destroy: () => void
}

interface Puff {
  /** world space, roughly metres, camera at origin looking down +z */
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  r: number
  a: number
  rot: number
  spin: number
  tex: number
  ph: number
}

/* -------------------------------------------------------------- textures -- */

function noiseField(size: number, cells: number): Float32Array {
  const g = new Float32Array((cells + 1) * (cells + 1))
  for (let i = 0; i < g.length; i++) g[i] = Math.random()

  const out = new Float32Array(size * size)
  const step = cells / size
  const smooth = (t: number) => t * t * (3 - 2 * t)

  for (let y = 0; y < size; y++) {
    const fy = y * step, y0 = Math.floor(fy), ty = smooth(fy - y0)
    for (let x = 0; x < size; x++) {
      const fx = x * step, x0 = Math.floor(fx), tx = smooth(fx - x0)
      const i = y0 * (cells + 1) + x0
      const a = g[i], b = g[i + 1], c = g[i + cells + 1], d = g[i + cells + 2]
      out[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    }
  }
  return out
}

/**
 * A puff, shaded as a sphere of vapour rather than a flat disc: alpha falls off
 * radially, then a lambert-ish term brightens the side facing the light and
 * lets the far side fall into shadow. That shading is what makes a billboard
 * read as volume when it drifts past another one.
 *
 * `tint` is the colour of the light hitting it. The shop's sign is the only
 * light source in the entrance, so the smoke has no business being neutral
 * grey — real smoke under a neon sign takes the sign's colour, and giving the
 * bank three different tints is what stops it reading as one flat fog.
 */
function makePuff(
  size: number, cells: number, lightX: number, lightY: number,
  tint: [number, number, number],
): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const d = img.data

  const n1 = noiseField(size, cells)
  const n2 = noiseField(size, cells * 2)
  const n3 = noiseField(size, cells * 4)
  const c = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const dx = (x - c) / c, dy = (y - c) / c
      const dist = Math.sqrt(dx * dx + dy * dy)

      let a = Math.max(0, 1 - dist)
      a = a * a * (3 - 2 * a)

      const fbm = n1[i] * 0.55 + n2[i] * 0.3 + n3[i] * 0.15
      a *= 0.3 + fbm * 1.0
      a = Math.max(0, Math.min(1, a))
      // Was `a *= a`. Squaring the falloff pulled the centre of every puff down
      // to about a fifth of full opacity, and once the per-puff alpha and the
      // depth fade were applied on top of that the whole bank came out at a few
      // percent — structure present, nothing visible. A gentler exponent keeps
      // the wispy edge and gives the core something to actually show.
      a = Math.pow(a, 1.35)

      // Fake a normal off the radial falloff and light it.
      const nz = Math.sqrt(Math.max(0, 1 - dist * dist))
      const lam = Math.max(0, dx * lightX + dy * lightY + nz * 0.55)
      const shade = 0.34 + lam * 0.78

      const o = i * 4
      const base = 236 + fbm * 19
      d[o]     = Math.min(255, base * tint[0] * shade)
      d[o + 1] = Math.min(255, base * tint[1] * shade)
      d[o + 2] = Math.min(255, base * tint[2] * shade)
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
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6)

  let w = 0, h = 0, focal = 0
  const resize = () => {
    w = host.clientWidth || window.innerWidth
    h = host.clientHeight || window.innerHeight
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    cv.style.width = w + 'px'
    cv.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // ~55mm-equivalent: wide enough for real parallax, not so wide that the
    // near puffs distort into streaks at the edges.
    focal = w * 0.9
  }
  resize()
  addEventListener('resize', resize)

  // Six sprites: three shapes x the sign's own palette. The first pass used one
  // neutral grey shape at a huge radius, and the result was a flat wash you
  // could barely see — no structure, no colour, nothing that read as smoke.
  // Smaller puffs and more of them is what puts billows in it; the tints are
  // what make it look lit rather than dirty.
  const WARM: [number, number, number] = [1.00, 0.82, 0.62]
  const PINK: [number, number, number] = [0.96, 0.66, 0.86]
  const COOL: [number, number, number] = [0.66, 0.80, 1.00]
  const TEX = [
    makePuff(220, 4, -0.15, 0.55, WARM),
    makePuff(220, 6, 0.30, 0.40, PINK),
    makePuff(220, 3, -0.40, 0.25, COOL),
    makePuff(220, 5, 0.10, 0.60, WARM),
    makePuff(220, 7, -0.30, 0.35, COOL),
    makePuff(220, 4, 0.42, 0.20, PINK),
  ]

  const density = opts.density ?? 1
  const COUNT = Math.round(Math.min(118, Math.max(56, (w * h) / 11000)) * density)

  const Z_NEAR = 1.1, Z_FAR = 7.5

  const puffs: Puff[] = []
  for (let i = 0; i < COUNT; i++) {
    // Even-ish spread through the volume, biased slightly to the back so the
    // near field stays open and the storefront reads through it.
    const z = Z_NEAR + Math.pow(Math.random(), 0.72) * (Z_FAR - Z_NEAR)
    puffs.push({
      x: (Math.random() - 0.5) * 5.6,
      // Weighted low. Smoke in a room pools and climbs; starting it evenly
      // through the frame is what made it look like fog on a lens.
      y: 1.5 - Math.pow(Math.random(), 0.8) * 3.6,
      z,
      vx: (Math.random() - 0.35) * 0.05,
      vy: -0.04 - Math.random() * 0.07,
      vz: (Math.random() - 0.5) * 0.02,
      // Roughly 190-520px on screen at the near plane, 30-80px at the far one.
      // The old 0.5-1.65 range projected to well over a thousand pixels a puff,
      // which is why sixty of them added up to one featureless cloud.
      r: 0.34 + Math.random() * 0.52,
      a: 0.30 + Math.random() * 0.26,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.00030,
      tex: i % TEX.length,
      ph: Math.random() * Math.PI * 2,
    })
  }

  let raf = 0, last = 0, blowing = 0, dead = false
  let onDone: (() => void) | null = null
  const BLOW_MS = 1500

  const frame = (t: number) => {
    if (dead) return
    const dt = last ? Math.min(48, t - last) : 16
    last = t
    const s = dt / 16

    ctx.clearRect(0, 0, w, h)

    // Plain source-over, deliberately, after trying `lighter`.
    //
    // Additive looked right in isolation but it cannot OCCLUDE: it only ever
    // adds light, so the storefront stayed perfectly legible through the
    // thickest part of the bank and the gust had nothing to reveal when it
    // cleared. The entrance only works if the smoke is actually hiding the
    // shop. Ordinary alpha both hides what is behind it and — because the
    // sprites are near-white and tinted with the sign's colours — brightens the
    // frame, which is what smoke under a neon sign genuinely does.
    //
    // Density therefore has to come from overlap rather than from blend mode:
    // big puffs, plenty of them, each at a moderate alpha, stacking up to an
    // opaque core with wispy edges.
    puffs.sort((p, q) => q.z - p.z)

    let alive = 0
    const gust = blowing ? Math.pow(Math.min(1, blowing / BLOW_MS), 2.4) : 0

    for (const p of puffs) {
      if (gust) {
        // The wind blows across and AWAY, so the volume empties toward the
        // horizon as well as off the side — that is what sells it as a room
        // clearing rather than a layer sliding.
        const catchIt = 1.6 / p.z
        p.x += gust * catchIt * 0.42 * s
        p.z += gust * catchIt * 0.30 * s
        p.y -= gust * catchIt * 0.05 * s
        p.a *= 1 - 0.020 * gust * s
      } else {
        // A cheap curl field. Two sines out of phase give each puff a slow
        // swirl that depends on where it is rather than on which puff it is,
        // so neighbours move together the way a real eddy makes them and the
        // bank stops looking like independent sprites on separate tracks.
        const cx = Math.sin(p.y * 1.7 + t * 0.00021 + p.ph) * 0.020
        const cy = Math.cos(p.x * 1.5 - t * 0.00017) * 0.014

        p.x += (p.vx + cx) * s * 0.06
        p.y += (p.vy + cy) * s * 0.06
        p.z += p.vz * s * 0.06
        p.rot += p.spin * s * 16
        p.r += Math.sin(t * 0.0004 + p.ph) * 0.0009 * s

        // Rising smoke thins as it climbs, then a fresh puff enters low. The
        // fade is what stops the top of the frame filling up with a hard edge.
        if (p.y < -1.1) p.a *= 1 - 0.006 * s
        if (p.y + p.r < -2.4 || p.a < 0.03) {
          p.y = 1.9 + Math.random() * 0.6
          p.x = (Math.random() - 0.5) * 5.6
          p.a = 0.30 + Math.random() * 0.26
        }
      }

      if (p.z <= 0.35 || p.a < 0.004) continue

      const k = focal / p.z
      const sx = w / 2 + p.x * k
      const sy = h * 0.46 + p.y * k
      const sr = p.r * k
      if (sx + sr < -60 || sx - sr > w + 60 || sr < 2) continue
      alive++

      // Aerial perspective: the far end of the volume loses contrast, which is
      // most of what makes a depth cue believable.
      const depth = (p.z - Z_NEAR) / (Z_FAR - Z_NEAR)
      const a = p.a * (1 - depth * 0.42)

      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, a))
      ctx.translate(sx, sy)
      ctx.rotate(p.rot + (gust ? gust * 0.25 : 0))
      ctx.drawImage(TEX[p.tex], -sr, -sr, sr * 2, sr * 2)
      ctx.restore()
    }

    if (blowing) {
      blowing += dt
      if (!alive || blowing > BLOW_MS + 800) {
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
        // A backgrounded tab stops rAF, so the promise would never settle and
        // the gate would stay up forever. Always let go.
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
