# Glen Smoke Shop

Landing site for **Glen Smoke Shop**, 944 Roosevelt Rd, Glen Ellyn, IL 60137.
Built by [Project Knox Solutions](https://github.com/projectknoxsolutions).

Live: `https://jeffbilbrey1985.github.io/Glen-Smoke-Shop/`

---

## Before this goes in front of the owner

Two facts in `src/data/store.json` are still open. The build prints a
warning for each one on every CI run until they're resolved.

| Field | Status | What's needed |
|---|---|---|
| `hours` | **Placeholder** | Google confirmed *"closes 11 PM"* on Sat 2026‑08‑08 and two directories list an 8 AM open, so the file says 8am–11pm daily. Get the real week from the owner, then set `hoursConfirmed: true`. |
| `smsCapable` | ✅ **Confirmed** | Jeff confirmed 2026‑08‑08 that `(331) 551‑0005` takes texts. If that turns out to be wrong, set it back to `false` and the text buttons silently fall back to calling rather than dead-ending. |
| `reviews` | **Empty** | `src/data/reviews.json` ships empty on purpose. The marquee degrades to a link-out. **Never invent testimonials** — they're an FTC problem and trivially disproved against the live Google profile. |

The phone number is confirmed: **(331) 551‑0005**, from the Google Business
Profile, updated by the business in July 2026. Yelp, Yahoo and Roadtrippers all
list a stale `(708) 926‑9214` — do not use it.

## Client rules, enforced by CI

`npm run guard` fails the build on either of the owner's hard rules:

- **No prices, anywhere.** Any `$`-amount or `x.99` pattern blocks the build.
- **No nitrous.** Galaxy Gas, Whip‑It!, Miami Magic, N2O — all blocked. The
  product is on his shelves; it is deliberately absent from the site because the
  category is under active FDA warning and state-level bans.

**The guard cannot see prices printed inside the photographs.** A frame audit
found legible shelf-tag prices in four frames and nitrous product in a fifth;
`pipeline/safe_crops.py` re-crops the masters to exclude them:

| Frame | Why |
|---|---|
| `IMG_6084` | Whole cigarillo wall printed with prices — kept only the top papers band |
| `IMG_6089` | "2 FOR $1.49" / "99¢" on the top humidor shelf — cropped off |
| `IMG_6083` | Swisher price flags behind the pouch wall — cropped off |
| `IMG_6087` | "5 FOR $1.59" on a background box — cropped off |
| `IMG_6086` | **Dropped entirely** — Whip-It! chargers and a Galaxy Gas box visible. Replaced by `IMG_6081`, itself cropped to remove a staff member's face at the register. |

**Re-run that audit before adding any new photo.** Read each frame as a 3x3 grid
of 2x-upscaled tiles; price tags are unreadable at a glance in the full frame.

Two further conventions the guard can't check, so they're written down here:

- **Hemp is presented by product form only**, never by brand. Several marks on
  that shelf belong to licensed state-cannabis operators, and naming them would
  imply a relationship the store doesn't have.
- **No health, effect or potency claims** for kratom or hemp. Brand and category
  only.

## Stack

| | |
|---|---|
| Build | Vite 8 + TypeScript, static output |
| Motion | GSAP ScrollTrigger + Lenis |
| Styling | Hand-authored CSS with design tokens in `src/styles/tokens.css` |
| Fonts | Self-hosted woff2, latin subset — no CDN dependency |
| Data | `src/data/*.json` — no backend, no API keys |

No framework. This is a single scroll page whose weight is images and motion;
a runtime would have cost ~40KB gzip and bought nothing the DOM wasn't already
doing.

### The 3D models

`public/models/` holds two real devices off the hardware counter — Uwell Caliburn
G2 in blue and red — lifted out of the 48MP frames with Meta's SAM 3D and
normalised by `pipeline/`'s sibling script in `models/normalize_glb.py`.

Why SAM and not Tripo: Tripo H3.1 read the packaging behind the device as part of
the object and returned a 57MB, 1.9-million-face mesh. SAM isolates the object,
which is the whole point, and lands at ~1MB and 4–6k triangles.

Generated meshes come back in an arbitrary orientation and scale.
`normalize_glb.py` stands each one upright on its longest axis, centres it and
scales it to 1 unit tall, so a single `camera-orbit` frames every model.

model-viewer (~290KB gzip) and the meshes are dynamically imported and only
fetched when the vape section is within 600px of the viewport — the main bundle
stays at 171KB and nobody pays for a feature they scroll past.

A third device (violet) was generated and discarded: SAM latched onto the wrong
object and returned a colourless blob. Check any new mesh before shipping it.

### The intro film

`../film/` is a Remotion project. It renders the age-gate film from the store's
own photographs — the sign catches and stutters on, the glow spills onto the
stucco, the room opens up, and it settles back on the storefront so the gate's
copy has somewhere quiet to land.

Two cuts, because the sign is a wide horizontal object: centre-cropping the 16:9
edit to 9:16 leaves you reading "SMOKE". Portrait uses the square band plate,
fits the frame's width rather than filling its height, and barely pushes in.

```bash
cd ../film && npm install
npx remotion render Intro         out/intro-master.mp4     --crf=18
npx remotion render IntroVertical out/intro-v-master.mp4   --crf=18
# then transcode to 1600x900 / 720x1280 mp4 + webm into site/public/video
```

MP4 is listed first — H.264 is smaller than our VP9 encode and universally
decodable; WebM covers builds without it. Sources and poster are attached in JS
by orientation, because `media` on `<source>` only works inside `<picture>`.
Any tap, click or key press skips the film — it is a gift, not a toll booth.

### The colour-cycling sign

The hero stacks two copies of the same storefront frame. The lower one is dimmed;
the upper one is masked to just the lit pixels and hue-rotated on a 14s loop.

Because it's the *same file*, the browser has already downloaded and decoded it —
the overlay costs no extra image bytes. Only a ~55KB grayscale mask ships
(`src/styles/img/hero-*-mask-*.webp`). `mask-size: cover` against an
identically-proportioned mask crops exactly the way `object-fit: cover` crops the
image, so the two stay in register at every viewport with no JavaScript.

Regenerate after changing the source photo:

```bash
python3 ../pipeline/hero_plates.py
```

## Images

Source frames are Apple ProRAW DNGs at 8064×6048. ImageMagick can't decode them
without a raw delegate, so `pipeline/` parses the DNG's TIFF IFDs directly and
lifts the full-resolution JPEG out of IFD0, applying the orientation tag.

Each frame is then rectified (vanishing points solved by RANSAC, homography
applied so verticals are actually vertical), graded, and exported to AVIF/WebP at
960/1600 (AVIF + progressive JPEG). `public/img` holds only the frames the site
references — nothing wider ships, since no section image renders above ~52vw.

```bash
npm run sync:images     # copy referenced derivatives into public/img
```

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run guard
npm run build      # -> dist/
npm run preview
```

`base` is `'./'`, so one build works both at the GitHub Pages project sub-path
and later at a bare domain root.

## A macOS gotcha worth knowing

This project was first staged under `~/Websites:CRM/`. **Do not keep it in a
folder whose name contains a colon.** macOS swaps `:` and `/` between the name
Finder displays and the name stored on disk, and GitHub Desktop (and other
Electron tooling) cannot resolve a path through it — it reports "this directory
does not appear to be a Git repository" for a perfectly healthy repo. Command
line `git` handles it fine, which makes it a confusing failure to diagnose.

The working copy now lives at `~/Desktop/Glen Smoke Shop/glen-smoke-shop`, which
is colon-free. Keep it there.

## Authenticating

GitHub has not accepted account passwords for git over HTTPS since 2021, and if
you sign in with Google SSO there is no password to fall back on. Use one of:

- **GitHub Desktop** — signs in through the browser, no token to manage.
- **A fine-grained token** — `deploy.sh` prompts for one. It needs exactly two
  permissions on `Glen-Smoke-Shop`: **Contents: Read and write** and
  **Workflows: Read and write**. The second is easy to miss and mandatory,
  because the push includes `.github/workflows/pages.yml`.
- `GITHUB_TOKEN=... ./deploy.sh` to skip the prompt.

## Deploying

Push to `main`. `.github/workflows/pages.yml` type-checks, runs the guard,
builds, and publishes `dist/`. Enable Pages → Source → **GitHub Actions** once in
repo settings.

### Moving to Cloudflare later

1. Cloudflare Pages → connect the repo → build `npm run build`, output `dist`.
2. `base: './'` already handles the root path — no code change.
3. Live Google reviews: add a Worker that proxies the Places API and returns the
   same shape as `reviews.json`. `initReviews()` reads from one place, so this is
   a small change rather than a rewrite.

## Two free wins to hand the owner

His Google Business Profile has **no website** and **no photos**. Adding the URL
and uploading the corrected 48MP store photos costs nothing and will measurably
improve how he ranks locally.
