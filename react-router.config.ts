import type { Config } from "@react-router/dev/config";
import { hydrogenPreset } from "@shopify/hydrogen/react-router-preset";

// Cloudflare Workers target, selected by `npm run cf-build`. See vite.config.ts.
const isCloudflare = process.env.CF_WORKERS === "true";

export default {
  presets: [hydrogenPreset()],
  appDirectory: "app",
  buildDirectory: "dist",
  ssr: true,
  future: {
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
    // @cloudflare/vite-plugin drives the server build through Vite's Environment
    // API. The Hydrogen preset turns this off for Oxygen, so re-enable it only
    // for the Cloudflare build — otherwise the SSR output lands in `dist/ssr`
    // while React Router still looks for it in `dist/server`.
    ...(isCloudflare && { v8_viteEnvironmentApi: true }),
  },
} satisfies Config;
