/* Cross-checks the three lists that have to agree, and fails loudly when they
   do not.

   Written after a commit reached production with a build that could never have
   succeeded. The section list in build-pages.mjs, the part registry in the same
   file, and the PAGES array in vite.config.ts are three separate hand-kept
   lists describing one set of pages. Two failures so far:

     1. `gear` was added to SECTIONS but not to vite's PAGES. The page generated
        at the repo root, passed every content check, and was never emitted into
        dist — the preview server's fallback served index instead, so it looked
        like it worked while being the home page wearing the right <title>.

     2. `hemp` was deleted but left registered in the part map, so P() threw
        ENOENT on a file that no longer existed. The Cloudflare build died in
        11 seconds. My local build died too and I did not notice, because I had
        chained `npm run build | grep "built in" && ls dist` — grep matched
        nothing, returned 1, the && swallowed the rest, and the output that DID
        print came from an unrelated check further down the line.

   That second one is the important lesson: a pipeline's exit status is the
   LAST command's, and grep returns non-zero when it finds nothing. Reading
   "some output appeared" as "the build passed" is how a broken build ships.
   This script exits non-zero, on purpose, and `npm run verify` chains it after
   an unpiped build. */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')

const build = read('scripts/build-pages.mjs')
const vite = read('vite.config.ts')

const sections = [...build.matchAll(/slug: '([\w-]+)'/g)].map(m => m[1])
const parts = [...build.matchAll(/^\s{2}([\w]+): P\('([\w.-]+)'\),/gm)].map(m => ({ key: m[1], file: m[2] }))
const vitePages = (vite.match(/const PAGES = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)

const problems = []

// 1. every part file must exist
for (const { key, file } of parts) {
  const f = path.join(ROOT, 'src/pages/parts', file)
  if (!fs.existsSync(f)) problems.push(`part "${key}" points at src/pages/parts/${file}, which does not exist`)
}

// 2. every section must be in vite's PAGES, or it never reaches dist
for (const slug of sections) {
  if (slug === 'index') continue
  if (!vitePages.includes(slug)) problems.push(`section "${slug}" is missing from PAGES in vite.config.ts — it will generate but never be emitted into dist`)
}

// 3. every vite page must have a generated html file at the root
for (const p of vitePages) {
  if (!fs.existsSync(path.join(ROOT, `${p}.html`))) problems.push(`vite.config.ts lists "${p}" but ${p}.html does not exist at the repo root`)
}

// 4. every generated page must have made it into dist
const dist = path.join(ROOT, 'dist')
if (fs.existsSync(dist)) {
  for (const p of vitePages) {
    if (!fs.existsSync(path.join(dist, `${p}.html`))) problems.push(`dist/${p}.html is missing after a build`)
  }
}

// 5. every server-rendered content block must have actually landed in dist.
//
//    These are the blocks that carry the shop's words — category names, brand
//    lists, glass shapes, botanical brands. They used to be written by main.ts
//    into empty containers, which meant a crawler downloaded eleven empty divs
//    and a script tag. They are built into the HTML now (scripts/blocks.mjs),
//    and the failure mode of that arrangement is silent: a renamed container id
//    or an edited part file leaves the div empty, the page still builds, still
//    looks right in a browser (nothing renders it client-side any more only
//    because we deleted that code — so no, it does not look right, but it does
//    still BUILD), and the page quietly de-indexes. So assert it.
if (fs.existsSync(dist)) {
  const { BLOCKS } = await import('./blocks.mjs')
  const ids = Object.keys(BLOCKS)
  const seen = new Set()
  for (const p of vitePages) {
    const f = path.join(dist, `${p}.html`)
    if (!fs.existsSync(f)) continue
    const html = fs.readFileSync(f, 'utf8')
    for (const id of ids) {
      const empty = new RegExp(`<div[^>]*\\bid="${id}"[^>]*></div>`)
      if (empty.test(html)) problems.push(`dist/${p}.html still has an EMPTY #${id} — the build-time block did not land, so that content is invisible to crawlers`)
      if (new RegExp(`\\bid="${id}"`).test(html)) seen.add(id)
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) problems.push(`scripts/blocks.mjs renders #${id}, but no page in dist has a container with that id — dead block, or a renamed container`)
  }
}

if (problems.length) {
  console.error('\nPage wiring is inconsistent:\n')
  for (const p of problems) console.error('  FAIL  ' + p)
  console.error(`\n${problems.length} problem(s).\n`)
  process.exit(1)
}

console.log(`Pages consistent: ${sections.length} sections, ${vitePages.length} entries, ${parts.length} parts.`)
