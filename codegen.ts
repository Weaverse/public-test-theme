import type { CodegenConfig } from "@graphql-codegen/cli";
import { getSchema, pluckConfig, preset } from "@shopify/hydrogen-codegen";

const INSTAGRAM_ADMIN_DOCUMENT = "./app/utils/instagram-token.ts";

export default {
  overwrite: true,
  pluckConfig,
  generates: {
    "storefront-api.generated.d.ts": {
      preset,
      schema: getSchema("storefront"),
      documents: [
        "./*.{ts,tsx,js,jsx}",
        "./app/**/*.{ts,tsx,js,jsx}",
        "./app/.server/**/*.{ts,tsx,js,jsx}",
        "!./app/routes/account/**/*.{ts,tsx,js,jsx}",
        `!${INSTAGRAM_ADMIN_DOCUMENT}`,
      ],
    },
    "customer-account-api.generated.d.ts": {
      preset,
      schema: [getSchema("customer-account")],
      documents: ["./app/routes/account/**/*.{ts,tsx,js,jsx}"],
    },
    ".cache/admin-api.generated.d.ts": {
      // Shopify's public introspection schema, matching shopify-admin.ts.
      schema: "https://shopify.dev/admin-graphql-direct-proxy/2026-04",
      documents: [INSTAGRAM_ADMIN_DOCUMENT],
      // Generate operation types without extending Hydrogen's storefront client.
      plugins: ["typescript-operations"],
    },
  },
} as CodegenConfig;
