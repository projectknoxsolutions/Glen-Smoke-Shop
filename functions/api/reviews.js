/* ==========================================================================
   /api/reviews — the shop's current five-star Google reviews, as JSON
   --------------------------------------------------------------------------
   A Cloudflare Pages Function. It exists for one reason: the browser cannot
   read the review feed directly.

   The reviews live in the shop's GoHighLevel reputation widget, which is
   served as a page on reputationhub.site. That page renders server-side and
   carries every review in a single JSON blob (window.__SSR_DATA__). It sets
   no CORS headers, so a fetch from glensmokeshop.com would be refused by the
   browser. Running the fetch here — same origin as the site, from Cloudflare's
   edge — sidesteps that entirely, and has the side benefit that the widget is
   hit once per cache period instead of once per visitor.

   The alternative was GoHighLevel's own iframe embed. It works, but it is
   their layout in their styling dropped into a dark, hand-built site, and it
   cannot be told to show only five-star reviews with actual text in them. This
   returns data instead, and the site renders it in its own markup.

   FAILURE IS NOT AN ERROR HERE. If reputationhub.site is slow, down, or
   changes the shape of its payload, this returns an empty list and the page
   keeps showing the verbatim reviews that were server-rendered into the HTML
   at build time. The section never empties and never shows a spinner. That is
   why every branch below returns 200 with `reviews: []` rather than throwing.
   ========================================================================== */

const WIDGET = 'https://reputationhub.site/reputation/widgets/review_widget/6eyUCv80A9C3rh8k9YgM'

/* How long the edge holds a copy. Reviews trickle in a few a week; a visitor
   seeing an hour-old set is fine, and it keeps us off the widget's back. */
const EDGE_TTL = 3600
const BROWSER_TTL = 900

/* Below this, a "review" is a star rating with a word attached and reads as
   filler in a card. Roughly a quarter of this shop's five-star reviews have no
   text at all — those are real ratings, they just have nothing to display. */
const MIN_TEXT = 12
const MAX_REVIEWS = 24
const FETCH_TIMEOUT = 8000

/**
 * Pull the JSON literal that follows `window.__SSR_DATA__ =` out of an HTML
 * document.
 *
 * Brace-matched rather than regexed. A regex either stops at the first `}`
 * (wrong — the object is deeply nested) or greedily runs to the last one
 * (wrong — it swallows the rest of the script). This walks the string once,
 * tracking whether it is inside a JSON string and whether the previous
 * character was an escape, and stops on the brace that closes the one it
 * opened with. Survives minification and reformatting; a rename of the global
 * is the only thing that breaks it, and that lands as an empty list.
 */
function extractSsrJson(html) {
  const marker = html.indexOf('window.__SSR_DATA__')
  if (marker === -1) return null

  const start = html.indexOf('{', marker)
  if (start === -1) return null

  let depth = 0, inString = false, escaped = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()

export async function onRequestGet(context) {
  const empty = { reviews: [], rating: null, count: null }

  let payload = null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
    const res = await fetch(WIDGET, {
      signal: ctrl.signal,
      headers: { 'accept': 'text/html' },
      cf: { cacheTtl: EDGE_TTL, cacheEverything: true },
    })
    clearTimeout(timer)
    if (res.ok) payload = extractSsrJson(await res.text())
  } catch {
    payload = null
  }

  if (!payload || !Array.isArray(payload.reviews)) return json(empty)

  const reviews = payload.reviews
    .filter(r => Number(r?.starRating) === 5)
    .map(r => ({
      name: clean(r.reviewerName),
      stars: 5,
      text: clean(r.comment),
      date: typeof r.dateAdded === 'string' ? r.dateAdded : null,
    }))
    .filter(r => r.name && r.text.length >= MIN_TEXT)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, MAX_REVIEWS)

  const agg = payload.aggregateData || {}
  return json({
    reviews,
    rating: typeof agg.totalRating === 'number' ? agg.totalRating : null,
    count: typeof agg.totalReviews === 'number' ? agg.totalReviews : null,
  })
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}, stale-while-revalidate=86400`,
    },
  })
}

/* Exported for the test harness; not part of the request path. */
export const __test = { extractSsrJson }
