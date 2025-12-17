# DreamStack Landing (production-ready Tailwind)

This project previously used the Tailwind CDN. It's now configured to build Tailwind locally for production using pnpm + Tailwind CLI.

Quick start (Windows / cross-platform)

1. Install dependencies (uses pnpm):

```bash
pnpm install
```

2. Build the production CSS:

```bash
pnpm run build
```

This generates `./dist/styles.css` which `index.html` references instead of the CDN.

3. Preview the site locally:

```bash
pnpm run preview
# then open the local address the server prints (e.g. http://localhost:3000)
```

Development

- Watch CSS while editing:

```bash
pnpm run watch:css
```

Development (auto-reload)

If you want a small dev server that automatically reloads the browser when files change, use:

```bash
pnpm run dev
```

This runs `live-server` on port 3000 and opens `/` in your browser. It will reload when HTML, CSS, or JS files change.

Optional housekeeping

- Update Browserslist DB (resolves the Browserslist warning):

```bash
pnpm run update-browserslist
```

Notes

- Tailwind config: `tailwind.config.cjs`
- Tailwind input CSS: `src/styles.css`
- Built CSS: `dist/styles.css`

Notes

- `pnpm run dev` uses `live-server` (installed as a devDependency) for quick development with auto-reload.
- `pnpm run preview` still uses `serve` via `pnpm serve .` (this may rely on npx if `serve` isn't installed globally). If you prefer, I can add `serve` as a devDependency.

If you'd like any additional scripts (e.g. a combined watcher + server, or a single command that builds and serves), tell me which behavior you prefer and I can wire it up.