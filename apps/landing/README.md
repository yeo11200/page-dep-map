# page-dep-map landing

Marketing site for [@shinjinseop/page-dep-map](https://www.npmjs.com/package/@shinjinseop/page-dep-map).

Next.js 14 App Router + Tailwind + framer-motion. Dark gradient, screenshots slide in on scroll.

## Local dev

```bash
pnpm install
pnpm --filter landing dev      # http://localhost:3500
pnpm --filter landing build    # production build
```

## Deploy to Vercel

1. Push the repo to GitHub (already at `github.com/yeo11200/page-dep-map`).
2. In Vercel dashboard, click **Add New Project** and import the repo.
3. **Important — set the project root**: `apps/landing`.
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `pnpm --filter landing build` (or leave default `next build` since project root is already scoped)
   - Install Command: `pnpm install` at workspace root (Vercel will pick up monorepo)
4. Add a custom domain if desired (otherwise Vercel gives you
   `page-dep-map.vercel.app`).
5. Push to `main` → preview/production deploys automatically.

The `metadataBase` in `app/layout.tsx` is set to `https://page-dep-map.vercel.app`.
Change it if you assign a different production domain.

## Where images live

All screenshots are in `public/images/`. They are copies of `docs/images/*.png`
at the repo root — copied during the initial scaffold so Next.js's `<Image>`
can serve them directly. If you regenerate the screenshots, sync them with:

```bash
cp docs/images/*.png apps/landing/public/images/
```
