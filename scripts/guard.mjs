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
  { re: /\b\d+\.99\b/,         why: 'looks like a price' },
  { re: /\bprice[sd]?\s*:\s*\d/i, why: 'looks like a price' },
]

// Text the guard should not police: our own rule text, and the phrase we use to
// tell visitors that prices are deliberately absent.
const ALLOW = [
  /don't post prices online/i,
  /do not publish prices/i,
  /Prices are not published online/i,
  /prices are ignored/i,
  /no prices/i,
  /talk numbers/i,
]

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'dist') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.html', '.ts', '.js', '.mjs', '.json', '.css'].includes(extname(p))) out.push(p)
  }
  return out
}

let failures = 0
for (const file of walk(ROOT)) {
  if (file.includes('/scripts/guard.mjs')) continue
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
