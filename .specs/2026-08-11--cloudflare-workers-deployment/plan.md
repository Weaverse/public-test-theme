# Plan: Cloudflare Workers Deployment

Source: https://weaverse.io/docs/guides/deployment/workers

## Files & Folders Touched

| Path                     | Change                                                |
| ------------------------ | ----------------------------------------------------- |
| `package.json`           | `@cloudflare/vite-plugin` + `wrangler` devDeps; `cf-*`, `check`, `deploy` scripts |
| `vite.config.ts`         | Swap `oxygen()` → `cloudflare()` when `CF_WORKERS=true` |
| `react-router.config.ts` | Enable `v8_viteEnvironmentApi` when `CF_WORKERS=true`  |
| `wrangler.json`          | New — Worker config (entry, compat flags, observability) |
| `.dev.vars.example`      | New — template for Worker env vars                    |
| `.gitignore`             | Ignore `.dev.vars`                                    |

Untouched: `server.ts`, `env.d.ts`, `app/**`.

## Steps

1. **Dependencies** — `@cloudflare/vite-plugin@^1.51.2` and `wrangler@^4.120.1`
   as devDependencies. (Already present in the working tree.)

2. **Vite config** — the Cloudflare plugin compiles for `workerd` and owns the
   dev/preview runtime, so it cannot coexist with `oxygen()`. Gate the swap on
   `process.env.CF_WORKERS === "true"` rather than deleting `oxygen()`, so
   `npm run dev`, `npm run build`, and `npm run preview` keep targeting Oxygen
   exactly as before. All existing customizations stay: `assetsInlineLimit: 0`
   (CSP), the `ssrStubClientOnlyModules` plugin, `manualChunks`, and the SSR
   optimizeDeps list.

2b. **React Router config** — `hydrogenPreset()` pins
   `future.v8_viteEnvironmentApi: false`, but `@cloudflare/vite-plugin` drives
   the server build through Vite's Environment API. With the flag off, the SSR
   output lands in `dist/ssr` while React Router still reads
   `dist/server/.vite/manifest.json`, and the build fails with ENOENT. Overriding
   the flag to `true` under the same `CF_WORKERS` gate fixes it; the Oxygen build
   keeps the preset's `false`. An env var is used here rather than Vite's
   `--mode` because `react-router.config.ts` cannot see the mode.

3. **wrangler.json** — `main: "./server.ts"`, `compatibility_flags:
   ["nodejs_compat"]` (Hydrogen uses Node built-ins), `keep_vars: true`,
   observability and source-map upload on. Worker name: `public-test-theme`.

4. **Environment variables** — copy `.dev.vars.example` → `.dev.vars`, fill in
   real values, then `npx wrangler secret bulk .dev.vars` to push them to the
   deployed Worker. `.dev.vars` is git-ignored.

5. **Scripts**

   | Script       | Command                                                  |
   | ------------ | -------------------------------------------------------- |
   | `cf-typegen` | `wrangler types && react-router typegen`                 |
   | `cf-build`   | `CF_WORKERS=true react-router build`                     |
   | `cf-dev`     | `wrangler dev --port 8787`                               |
   | `cf-preview` | `CF_WORKERS=true vite preview`                           |
   | `check`      | `tsc --noEmit && npm run cf-build && wrangler deploy --dry-run` |
   | `deploy`     | `npm run cf-build && wrangler deploy`                    |

   `deploy` chains `cf-build` (the guide runs `wrangler deploy` alone) so a stale
   Oxygen bundle from `npm run build` can never be shipped to Cloudflare.

   `cf-build` writes the Worker to `dist/server/` (with a generated
   `wrangler.json`) and client assets to `dist/client/`. Plain `wrangler deploy`
   from the project root auto-detects that output — no `-c` flag needed.

6. **Deploy** — `npx wrangler login`, `npm run check`, `npm run deploy`.
   Watch `npx wrangler tail` on the first deploys.

## Deviations from the guide

- Oxygen plugin kept and flag-gated instead of removed (guide replaces it).
- `v8_viteEnvironmentApi: true` added — not in the guide, but required with this
  version of the Hydrogen React Router preset. See step 2b.
- `deploy` builds first instead of assuming a fresh build.
- `cf-preview` added as the plugin-native alternative to `cf-dev`.
- `.dev.vars.example` also lists this theme's extra `Env` keys from `env.d.ts`
  (GTM, Judge.me, Klaviyo, metafield/metaobject config, Shopify Inbox).

## Open Risks

- **Not a supported preset.** Weaverse ships configured for Oxygen and Shopify
  publishes no Cloudflare Workers entry for Hydrogen. Validate end-to-end.
- **Sessions and caching** may behave differently than on Oxygen — verify cart
  persistence, customer account login, and sub-request cache behaviour.
- **Types.** `env.d.ts` references `@shopify/oxygen-workers-types`; `cf-typegen`
  emits `worker-configuration.d.ts` from wrangler. If the two collide, drop the
  Oxygen types reference for the Cloudflare build.
- **`cf-dev`.** `wrangler dev` bundles `server.ts` directly and does not run
  Vite, so the `virtual:react-router/server-build` import may not resolve. If it
  fails, use `vite dev --mode cloudflare` (the plugin's native dev server) instead.

- **Local `.env` leaks into `dist`.** The Cloudflare plugin reads the existing
  `.env` and writes `dist/server/.dev.vars` for local runs. `dist/` is
  git-ignored, but do not publish the build output anywhere. Production values
  must still be pushed with `wrangler secret bulk`.

## Verification Checklist

- [x] `npm run build` still works (Oxygen path unregressed) — verified 2026-08-11
- [x] `tsc --noEmit` clean — verified 2026-08-11
- [x] `npm run cf-build` produces `dist/server` + `dist/client` — verified 2026-08-11
- [x] `wrangler deploy --dry-run` resolves the Worker and 102 asset files — verified 2026-08-11
- [ ] `npm run dev` still works (Oxygen path unregressed)
- [ ] Secrets uploaded via `wrangler secret bulk .dev.vars`
- [ ] Worker deploys and serves the homepage, PDP, and cart
- [ ] Weaverse Studio editing works against the deployed Worker
