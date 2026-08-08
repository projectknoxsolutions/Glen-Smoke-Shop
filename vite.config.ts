import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so one build works both at the GitHub Pages project sub-path
  // (/Glen-Smoke-Shop/) and later at a bare domain root on Cloudflare.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    cssCodeSplit: false,
  },
})
