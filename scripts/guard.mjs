#!/usr/bin/env node
/**
 * Build guard.
 *
 * The owner has two hard rules — no prices anywhere, and no nitrous products —
 * and both are the kind of thing that quietly creeps back in months later when
 * someone adds a product. This fails the build instead of relying on memory.
 *
 * Unconfirmed facts (store hours, whether the line accepts SMS) are reported as
 * warnings so they stay visible in every CI run until they're nailed down.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

const BANNED = [
  { re: /galaxy\s*gas/i,       why: 'nitrous brand (client excluded nitrous entirely)' },
  { re: /whip[-\s]?it!?/i,     why: 'nitrous charger brand' },
  { re: /miami\s*magic/i,      why: 'nitrous brand' },
  { re: /nitrous\s*oxide/i,    why: 'nitrous' },
  { re: /\bN2O\b/,             why: 'nitrous' },
  { re: /\$\s?\d/,             why: 'looks like a price — the owner does not want prices online' },
  // Leading digit 1-9 on purpose. `0.99` is a fraction — a crop coordinate, an
  // opacity, an easing value — and never a price written that way; "$0.99" is
  // still caught by the rule above. Before this, pipeline-retouch.json could not
  // be committed because two crop boxes happen to end at 0.99, and a guard that
  // fires on coordinates is a guard people start editing around.
  { re: /\b[1-9]\d*\.99\b/,    why: 'looks like a price' },
  { re: /\bprice[sd]?\s*:\s*\d/i, why: 'looks like a price' },
]

// Text the guard should not police: our own rule text, and the comments that
// explain the rule. The visitor-facing "we don't post prices" sentences the
// owner asked us to remove are deliberately NOT allow-listed any more — if one
// creeps back into the copy, that is now a finding rather than an exemption.
const ALLOW = [
  /no prices/i,
  /does not want prices/i,
  /no potency figures/i,
]

// The build tooling is skipped: `$1`/`$2` inside a regex replacement is not a
// price, and letting the guard trip over its own scaffolding trains people to
// ignore it. What ships is what matters — dist/ is scanned explicitly below.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'scripts'])

function walk(dir, out = [], exts = ['.html', '.ts', '.js', '.mjs', '.json', '.css']) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out, exts)
    else if (exts.includes(extname(p))) out.push(p)
  }
  return out
}

// Source first, then the built output if it exists — the artifact is the thing
// a customer actually reads, and a templating mistake could introduce a price
// that never appears in any source file.
const targets = walk(ROOT)
// Only the markup and stylesheets from dist: minified bundles are full of
// `$1` and `.99` fragments from library internals, and their real source is
// already scanned above. Scanning them only produces noise.
try { walk(join(ROOT, 'dist'), targets, ['.html', '.css']) } catch { /* not built yet */ }

let failures = 0
for (const file of targets) {
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    if (ALLOW.some(a => a.test(line))) continue
    for (const { re, why } of BANNED) {
      if (re.test(line)) {
        console.error(`FAIL ${file.replace(ROOT, '')}: ${why}\n     ${line.trim().slice(0, 120)}`)
        failures++
      }
    }
  }
}

// Unconfirmed facts stay loud until someone confirms them with the owner.
const store = JSON.parse(readFileSync(join(ROOT, 'src/data/store.json'), 'utf8'))
if (!store.hoursConfirmed) {
  console.warn('WARN store hours are still the placeholder estimate — confirm with the owner and set hoursConfirmed:true')
}
if (!store.smsCapable) {
  console.warn('WARN the phone line is not confirmed SMS-capable, so text buttons fall back to calling')
}
const reviews = JSON.parse(readFileSync(join(ROOT, 'src/data/reviews.json'), 'utf8'))
if (!reviews.reviews.length) {
  console.warn('WARN reviews.json is empty — the marquee is rendering its link-out placeholder')
}

if (failures) {
  console.error(`\n${failures} guard violation(s). Build blocked.`)
  process.exit(1)
}
console.log('Guard passed: no prices, no nitrous.')
