# لندینگ لوازم خودرو (اسنپ‌پی)

Mobile-first landing with no framework and no runtime dependencies (Vite is only the dev server and bundler). It uses the same `sp-*` design system as
`snapppay.ir/ec-service` and `snapppay.ir/ec-cashback`: a 480px column, brand `#008dfa`, and the same card, panel and spacing tokens.

## Run

Built with [Vite](https://vite.dev). Requires Node 20.19+.

```bash
npm install
npm run dev         # development: dev server on :5173 with HMR, CSVs never cached, data checks in the console
npm run build       # production: minified build in dist/, no source maps, no data checks
npm run build:dev   # development build: unminified, with source maps and data checks (for staging/debugging)
npm run preview     # serve dist/ on :4173 to check a build
```

| | `dev` / `build:dev` (`.env.development`) | `build` (`.env.production`) |
|---|---|---|
| Minified | no | yes |
| Source maps | yes | no |
| CSV caching (`VITE_DATA_CACHE`) | `no-store` (always fresh) | `no-cache` (revalidate) |
| Data checks from `data/schema.json` (console) | yes | removed from bundle |
| Base path (`VITE_BASE`) | `/` | `./` (works under any sub-path) |

Put machine-specific overrides in `.env.development.local` / `.env.production.local` (git-ignored).

`landing.config.json`, `data/` and `assets/images/` are loaded at runtime, so the build copies them into `dist/` as they
are. Editors can replace the CSVs on the server without rebuilding. Design-source PNGs (`assets/images/hero/*-new.png`)
are not copied into the build.

## Content

All content comes from `landing.config.json` and the CSVs in `data/`. To publish, replace the values and image paths in the
CSVs and keep the IDs and column names. The code doesn't need to change.

- Rows with `active=0` are hidden, and rows are sorted by `order`.
- Coupons with no code or logo are dropped, and so are expired coupons.
- Offline merchants never get a website link. Branches (call and directions) appear for `offline` and `both` merchants.
- If a CSV fails to load, only that section shows an error with a retry button. An empty CSV shows an empty-state message.
- `utm_*` parameters on the landing URL are added to outbound links when the CSV link doesn't already set them.
- **All URLs in the sample data point to `example.com` and must be replaced before publishing.**

## Sections

| # | Section | Notes |
|---|---------|-------|
| 1 | Hero | Five category chips float over the hero image, like the reference. Each one opens an in-page panel for its category. |
| 2 | Subcategories | Two endless rows moving in opposite directions. They run on native scroll, so they can be swiped. They pause on touch, hover, keyboard focus, when off-screen or when the panel is open, and stop under `prefers-reduced-motion`. |
| 3 | Products | The reference offer card, with category filter chips. |
| 4 | Merchants | Tall storefront cards that open the merchant page. |
| 5 | Coupons | A new design: a ticket card with a perforated tear line, days left, conditions, and one-tap copy (with a fallback for in-app webviews). |
| 6 | Three tiles | The reference puzzle layout (two half tiles and one wide one), each linked to its merchants. |
| 7 | Stores | A two-row horizontal grid. "View all" opens a searchable list filtered by online / in-store. |

Everything opens inside a single `<dialog>` that holds a stack of views. Each view adds a history entry, so the phone's
back gesture steps back through the views and then closes the panel.

## Structure

```
index.html
assets/css/   base (tokens) · hero · categories · products · merchants · coupons · tiles · stores · panel
assets/js/    app (bootstrap) · data (CSV loading) · validate (dev-only checks) · sections · components · views · panel · marquee · drag-scroll · ui
vite.config.js · .env.development · .env.production
```
