/* ==========================================================================
   Review card markup — one renderer, two callers
   --------------------------------------------------------------------------
   The review marquee is built TWICE, on purpose, from this one file:

     - at build time by scripts/blocks.mjs, from the verbatim reviews in
       reviews.json, so the section is real HTML in the document a crawler
       downloads and paints instantly with no layout shift; and
     - at runtime by main.ts, which replaces that markup with the current
       five-star reviews pulled live from the Google Business Profile.

   Two renderers would drift and the swap would flicker as the cards changed
   shape mid-animation, so there is exactly one. If you change a class name
   here, both sides move together.

   ESCAPING IS NOT OPTIONAL HERE. The build-time reviews are hand-checked, but
   the runtime ones arrive over the network from a third party, and they land
   via innerHTML. Every interpolated value goes through esc(). A review whose
   author is called `<img onerror=...>` must render as text.
   ========================================================================== */

/** Avatar colours, cycled by index. Matches the site's accent set. */
export const AV = ['#FF8A1E', '#2E6BFF', '#FF2D9B', '#35FF7A', '#FFC24D']

/** HTML-escape a value for interpolation into innerHTML. */
export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only ever http(s). Blocks javascript: and data: URLs arriving from the API. */
export function safeUrl(u) {
  const s = String(u == null ? '' : u).trim()
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ''
}

/**
 * One review card.
 *
 * `url` is the link back to the review on Google. Google's Business Profile
 * terms require that a reader can always reach the original review, so when a
 * URL is present the author's name becomes the link. When it is absent the
 * name is plain text rather than a dead anchor.
 */
export function reviewCard(r, i) {
  const name = String(r.name || '').trim()
  const init = (r.initial || name[0] || '?').toUpperCase()
  const full = Math.max(0, Math.min(5, Math.round(Number(r.stars) || 0)))
  const href = safeUrl(r.url)
  const who = href
    ? `<a class="nm" href="${esc(href)}" target="_blank" rel="noopener nofollow">${esc(name)}</a>`
    : `<span class="nm">${esc(name)}</span>`

  return `<article class="rev-card">
      <p class="t">"${esc(r.text)}"</p>
      <div class="m">
        <span class="av" style="background:${AV[i % AV.length]}">${esc(init)}</span>
        <span>${who}
          <span class="st" style="display:block">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span></span>
      </div></article>`
}

/**
 * The full marquee.
 *
 * Two counter-scrolling rows only make sense with enough cards to fill both.
 * With three reviews, splitting them 2/1 left the second row visibly thin and
 * drew attention to how few there are. Under six, run a single row and repeat
 * it enough times to cover the widest viewport instead. Once the live feed is
 * wired the count is usually into double figures and both rows engage.
 */
export function marqueeHtml(list) {
  const rows = (rs, cls, reps) =>
    `<div class="rev-row ${cls}">${Array.from({ length: reps }, () => rs.map(reviewCard).join('')).join('')}</div>`

  if (!list.length) return ''
  if (list.length < 6) return rows(list, 'a', Math.max(3, Math.ceil(9 / list.length)))
  const half = Math.ceil(list.length / 2)
  return rows(list.slice(0, half), 'a', 2) + rows(list.slice(half), 'b', 2)
}
