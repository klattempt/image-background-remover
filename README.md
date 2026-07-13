# Cutline — Image Background Remover

Batch-remove backgrounds from ecommerce product photos and export consistent 2000 × 2000 white-background JPEGs. Images are processed in transit and are never persisted by the application.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Cloudflare Workers via OpenNext
- remove.bg API
- Browser Canvas and fflate for local image composition and ZIP export

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

For local UI development without Turnstile, leave both Turnstile variables empty. The batch-session endpoint accepts a development-only bypass token when `NODE_ENV` is not `production`. A real `REMOVE_BG_API_KEY` is still required to process images.

## Production secrets

Configure these before deployment:

```bash
npx wrangler secret put REMOVE_BG_API_KEY
npx wrangler secret put BATCH_SIGNING_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `APP_ORIGIN` as build variables. Also configure a Cloudflare WAF/Rate Limiting rule for `POST /api/remove-background`; the in-process limiter is a secondary guard and is not globally durable across Worker isolates.

## Commands

```bash
npm run dev       # Next.js development server
npm run lint      # ESLint
npm run test      # Unit tests
npm run build     # Next.js production build
npm run preview   # Build and preview in workerd
npm run deploy    # Deploy with OpenNext to Cloudflare Workers
```

The product requirements are in [`docs/MVP-PRD.md`](docs/MVP-PRD.md).
