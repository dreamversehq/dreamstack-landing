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

3. Preview the site locally (uses `npx serve`):

```bash
pnpm run preview
# then open http://localhost:5000 (or the port `serve` prints)
```

Development

- Watch CSS while editing:

```bash
pnpm run watch:css
```

Optional housekeeping

- Update Browserslist DB (resolves the Browserslist warning):

```bash
pnpm run update-browserslist
```

Notes

- Tailwind config: `tailwind.config.cjs`
- Tailwind input CSS: `src/styles.css`
- Built CSS: `dist/styles.css`

If you'd like, I can add a devDependency for a tiny static server (so `pnpm run preview` doesn't rely on `npx`) or wire a simple `serve` devDependency. Want that added?