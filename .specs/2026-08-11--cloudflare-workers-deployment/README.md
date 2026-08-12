# Feature: Cloudflare Workers Deployment

| Field            | Value      |
| ---------------- | ---------- |
| **Status**       | in-progress |
| **Owner**        | @ken       |
| **Created**      | 2026-08-11 |
| **Last Updated** | 2026-08-11 |

## Original Prompt

> https://weaverse.io/docs/guides/deployment/workers
> apply to depoy cloudflare worker

## Summary

Adds a Cloudflare Workers deployment target alongside the existing Shopify Oxygen
target, following the official Weaverse guide. The Cloudflare Vite plugin is
selected by build mode so the default Oxygen dev/build workflow keeps working
unchanged; `npm run cf-build` / `npm run deploy` build and ship the Worker.
