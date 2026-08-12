import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { hydrogen } from "@shopify/hydrogen/vite";
import { oxygen } from "@shopify/mini-oxygen/vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

// Cloudflare Workers target, selected by `npm run cf-build` (CF_WORKERS=true).
// The Cloudflare plugin compiles for `workerd` and replaces Oxygen's dev/preview
// runtime, so the two plugins are mutually exclusive — keeping this behind a flag
// leaves the default Oxygen workflow (`npm run dev` / `npm run build`) untouched.
// react-router.config.ts reads the same flag to enable the Vite Environment API.
const isCloudflare = process.env.CF_WORKERS === "true";
// Client-only heavy modules replaced with a stub in the SSR build. The
// worker bundle inlines all dynamic imports, so React.lazy alone cannot
// keep them out of the server file — react-player's media stack (hls.js,
// dashjs, media-chrome, Mux/Vimeo) is ~3MB of cold-start parse cost that
// can only ever run in a browser. See app/utils/ssr-client-only-stub.ts.
const SSR_STUBBED_MODULES = new Set(["react-player"]);
function ssrStubClientOnlyModules(): Plugin {
  return {
    name: "ssr-stub-client-only-modules",
    enforce: "pre",
    resolveId(id, _importer, options) {
      if (options?.ssr && SSR_STUBBED_MODULES.has(id)) {
        return fileURLToPath(
          new URL("./app/utils/ssr-client-only-stub.ts", import.meta.url),
        );
      }
      return null;
    },
  };
}
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    hydrogen(),
    isCloudflare ? cloudflare({ viteEnvironment: { name: "ssr" } }) : oxygen(),
    reactRouter(),
    tailwindcss(),
    ssrStubClientOnlyModules(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    assetsInlineLimit: 0,
    ...(!isSsrBuild && {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Do NOT force react-player into a manual chunk: it is
            // lazy()-imported only by the hero-video section. Co-locating it
            // with an eager dep (swiper, used by the homepage slideshow) drags
            // its media stack (hls/mux/vimeo) onto every page and defeats the
            // lazy boundary. Let Rollup split it with its dynamic import.
            if (id.includes("swiper")) return "vendor-media";
            if (id.includes("react-share")) return "vendor-social";
            if (id.includes("@radix-ui")) return "vendor-radix";
          },
        },
      },
    }),
  },
  server: {
    hmr: process.env.HMR !== "false",
    warmup: {
      clientFiles: [
        "./app/routes/**/*",
        "./app/sections/**/*",
        "./app/components/**/*",
      ],
    },
    allowedHosts: true,
  },
  ssr: {
    optimizeDeps: {
      include: [
        "@radix-ui/react-primitive",
        "jsonp",
        "classnames",
        "react-share",
      ],
    },
  },
}));
