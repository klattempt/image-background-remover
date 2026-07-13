# Cutline — Image Background Remover

Batch-remove backgrounds from ecommerce product photos and export consistent 2000 × 2000 white-background JPEGs. Images are processed in memory and are never persisted by the application.

## Stack

- Next.js 16 static export and React 19
- Tailwind CSS 4
- Cloudflare Pages and Pages Functions
- remove.bg API
- Browser Canvas and fflate for local image composition and ZIP export

## Local development

```bash
npm install
cp .env.example .env.local
npm run build
npm run preview
```

`npm run preview` serves the static export and `/functions` routes with Wrangler. When the site runs on localhost and no Turnstile secret is configured, the batch-session endpoint accepts the frontend's `dev-bypass` token. A real `REMOVE_BG_API_KEY` is still required to process images.

## Cloudflare Pages

Use these Git build settings:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `out`

Configure `REMOVE_BG_API_KEY`, `BATCH_SIGNING_SECRET`, and `TURNSTILE_SECRET_KEY` as encrypted production variables. Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `APP_ORIGIN`, and optionally `MAX_REQUESTS_PER_HOUR` as regular variables.

## Commands

```bash
npm run dev              # Next.js UI development only
npm run lint             # ESLint
npm run test             # Unit tests
npm run build            # Static export to out/
npm run functions:build  # Bundle Pages Functions
npm run preview          # Build and run Pages locally
npm run deploy           # Direct Pages deployment
```

The product requirements are in [`docs/MVP-PRD.md`](docs/MVP-PRD.md).
