/* ==========================================================================
   The neon header

   The shop's own sign, rebuilt as a real neon installation and filmed: gold
   "Glen" and the flame-and-cigar badge, white "SMOKE SHOP", the whole box
   traced in glass tube that runs orange -> pink -> violet -> blue -> green
   while smoke drifts past it against a dark brick wall.

   WHY A CLIP AND NOT A MESH
   -------------------------
   The first version of this file drove a glTF reconstruction of the sign in
   model-viewer and animated `emissiveFactor` on its materials. It worked, and
   it looked like what it was: a single photograph inflated into geometry. The
   material had no emissive texture, so lighting the letters lit the whole
   surface — pushed hard enough to read as neon it flattened the gold and the
   white into coloured slabs, and pulled back far enough to keep them it barely
   read as neon at all. There is no setting between those two that is good.

   The clip has none of that problem because the neon in it is neon: real
   tubes, real falloff, real bounce on the brick, and the lettering is
   pixel-exact because it was generated from the 48MP frame of the actual sign.
   It is also a fifth of the bytes of the mesh and does not need a 1MB WebGL
   runtime to display.

   It is a ping-pong: five seconds forward, five back. That makes the loop
   seamless by construction rather than by a crossfade that would smear the
   tubes, and reversing a colour sweep still looks exactly like a colour sweep.

   DEGRADATION
   -----------
   The static two-plate sign underneath is not a placeholder, it is the
   fallback, and it stays in the DOM. It is only hidden once the video is
   genuinely playing. If the file 404s, if the codec is unsupported, or if
   autoplay is refused outright, the header is still a complete header.
   Reduced motion never starts the video at all and keeps the still frame.
   ========================================================================== */

export function initLogo3D() {
  const stage = document.querySelector<HTMLElement>('#logo3d')
  if (!stage) return

  const mp4 = stage.dataset.mp4
  const webm = stage.dataset.webm
  const poster = stage.dataset.poster
  if (!mp4) return

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const st = stage.closest('.signstage')

  /** Swap the flat plates out for whatever we managed to put up. */
  const takeOver = () => {
    stage.classList.add('is-live')
    st?.classList.add('mesh-live')
    // A class the loader sets, not a :has() rule. The selector version left the
    // static wordmark ghosting through at a different scale, and a class
    // toggled from here cannot silently fail to match.
    st?.querySelector('.signwrap')?.classList.add('is-replaced')
  }

  const giveUp = () => {
    stage.classList.remove('is-live')
    st?.classList.remove('mesh-live')
    st?.querySelector('.signwrap')?.classList.remove('is-replaced')
    stage.replaceChildren()
  }

  // Reduced motion gets the poster frame — the sign lit, holding one colour.
  // Still the good artwork, just not moving.
  if (reduced) {
    if (!poster) return
    const img = document.createElement('img')
    img.className = 'logo3d-still'
    img.src = poster
    img.alt = 'The Glen Smoke Shop sign in neon'
    img.decoding = 'async'
    img.addEventListener('load', takeOver)
    img.addEventListener('error', giveUp)
    stage.appendChild(img)
    return
  }

  let started = false

  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting || started) return
    started = true
    io.disconnect()

    const v = document.createElement('video')
    v.className = 'logo3d-video'
    v.muted = true          // set BEFORE src: iOS decides autoplay eligibility
    v.defaultMuted = true   // survives the attribute round-trip in Safari
    v.loop = true
    v.playsInline = true
    v.autoplay = true
    v.preload = 'auto'
    v.setAttribute('aria-hidden', 'true')
    if (poster) v.poster = poster

    if (webm) {
      const s = document.createElement('source')
      s.src = webm; s.type = 'video/webm'
      v.appendChild(s)
    }
    const s2 = document.createElement('source')
    s2.src = mp4; s2.type = 'video/mp4'
    v.appendChild(s2)

    // `playing` rather than `canplay`: canplay fires on a video that a
    // power-saving browser then refuses to start, and swapping the plates out
    // for a frozen first frame is worse than leaving them alone.
    v.addEventListener('playing', takeOver, { once: true })
    v.addEventListener('error', giveUp)

    stage.appendChild(v)

    // Autoplay refused (low-power mode, data saver, some enterprise policies).
    // The poster is a still of the same neon sign, so showing it is a better
    // header than the flat plate — but only once we know the frame is there.
    v.play().catch(() => {
      if (v.readyState >= 2) takeOver()
    })

    // Stop decoding when the header scrolls away.
    const vis = new IntersectionObserver(es => {
      if (es[0].isIntersecting) v.play().catch(() => { })
      else v.pause()
    }, { rootMargin: '80px' })
    vis.observe(stage)
  }, { rootMargin: '400px' })

  io.observe(stage)
}
