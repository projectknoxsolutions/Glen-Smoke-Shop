#!/usr/bin/env bash
#
# Push this repo to GitHub and let the Pages workflow publish it.
#
#   ./deploy.sh
#
# Run it from the folder you unzipped everything into.
#
# The local build is a convenience, not a requirement — GitHub Actions builds
# the site itself from a clean checkout. If npm has any trouble here, this still
# pushes and tells you where to watch the real build. Nothing about a local
# toolchain should stand between you and a live URL.
#
set -uo pipefail

REPO="https://github.com/projectknoxsolutions/Glen-Smoke-Shop.git"
LIVE="https://projectknoxsolutions.github.io/Glen-Smoke-Shop/"

say()  { printf '\n\033[1;33m==>\033[0m %s\n' "$1"; }
warn() { printf '\n\033[1;35mWARN:\033[0m %s\n' "$1"; }
die()  { printf '\n\033[1;31mERROR:\033[0m %s\n\n' "$1" >&2; exit 1; }

# Say where we died rather than exiting mutely, which is exactly what the
# earlier `npm install --silent` under `set -e` did.
trap 'c=$?; [ $c -ne 0 ] && printf "\n\033[1;31mFAILED\033[0m (exit %s) — the last command above is the one that failed.\n" "$c"' EXIT

# --- sanity ------------------------------------------------------------------
[ -f index.html ] || die "run this from the folder containing index.html"

imgs=$(ls public/img/*.avif 2>/dev/null | wc -l | tr -d ' ')
vids=$(ls public/video/*.mp4 2>/dev/null | wc -l | tr -d ' ')
mods=$(ls public/models/*.glb 2>/dev/null | wc -l | tr -d ' ')
[ "$imgs" -ge 40 ] || die "public/img only has $imgs AVIFs — unzip the images archives here first."
[ "$vids" -ge 2 ]  || die "public/video is missing the film — unzip the video archive here first."
[ "$mods" -ge 2 ]  || die "public/models is missing the 3D meshes — unzip the code archive here first."
say "Found $imgs images, $vids video files and $mods 3D models."

command -v git >/dev/null || die "git is not installed. Run: xcode-select --install"

# --- optional local build ----------------------------------------------------
BUILD_OK=0
if command -v npm >/dev/null 2>&1; then
  node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  say "node $(node -v 2>/dev/null || echo '?') · npm $(npm -v 2>/dev/null || echo '?')"

  if [ "${node_major:-0}" -lt 20 ] 2>/dev/null; then
    warn "Vite 8 needs Node 20.19+ and you have $(node -v 2>/dev/null). Skipping the local
     build — Actions builds on Node 22, so the deploy is unaffected.
     To build locally later:  brew install node"
  else
    say "Installing dependencies… (full output below — this takes a minute)"
    if npm install --no-audit --no-fund; then
      say "Type checking…"
      npm run typecheck || warn "typecheck reported problems"
      say "Checking the client rules (no prices, no nitrous)…"
      npm run guard || warn "the guard reported problems — review before showing the owner"
      say "Building…"
      if npm run build; then BUILD_OK=1; say "Local build succeeded."; fi
    else
      warn "npm install failed (see the output above). Pushing anyway — Actions builds
     from a clean checkout, so a local npm problem does not block the deploy."
    fi
  fi
else
  warn "npm not found — skipping the local build. Actions will build it."
fi
[ "$BUILD_OK" -eq 1 ] || warn "No verified local build. The Actions run is the source of truth."

# --- git ---------------------------------------------------------------------
if [ ! -d .git ]; then
  say "Initialising the repository…"
  git init -q || die "git init failed"
fi
git branch -M main

if [ -n "$(git status --porcelain)" ]; then
  say "Committing changes…"
  git add -A
  git commit -q -m "Glen Smoke Shop — Neon Noir landing site" \
    || die "commit failed — set your identity first:
     git config --global user.name  \"Your Name\"
     git config --global user.email \"you@example.com\""
else
  say "Nothing new to commit."
fi

if git remote | grep -qx origin; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi

# The remote starts with one placeholder commit; merge it rather than clobber.
say "Fetching the remote…"
if git fetch -q origin main 2>/dev/null; then
  if ! git merge origin/main --allow-unrelated-histories -m "Merge the repo's initial commit" -q 2>/dev/null; then
    say "README conflicted with the placeholder — keeping ours."
    git checkout --ours README.md 2>/dev/null || true
    git add -A
    git commit -q -m "Merge the repo's initial commit"
  fi
fi

say "Pushing to GitHub… (about 40MB — give it a minute)"
git push -u origin main || die "push failed.
     If it asked for a password, GitHub wants a personal access token, not your
     account password. Easiest fix:  brew install gh && gh auth login"

trap - EXIT
cat <<EOF

  Pushed.

  The Pages workflow is running now:
    https://github.com/projectknoxsolutions/Glen-Smoke-Shop/actions

  The first run switches Pages from Jekyll over to Actions, so it can take 2-3
  minutes. After that the site is live at:
    $LIVE

  If the workflow fails on permissions, open
    Settings -> Actions -> General -> Workflow permissions
  choose "Read and write permissions", then re-run the job.

  Then revoke the token you shared — it is not needed any more.

EOF
