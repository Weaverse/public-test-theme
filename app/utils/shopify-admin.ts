import { CacheCustom } from "@shopify/hydrogen";
import type { WeaverseClient } from "@weaverse/hydrogen";

/** Pinned to match the Hydrogen release this project runs on. */
const ADMIN_API_VERSION = "2026-04";

export type AdminConfig = {
  endpoint: string;
  accessToken: string;
  weaverse: WeaverseClient;
};

type AdminResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/**
 * Build an Admin API config from the environment.
 *
 * Returns `null` when credentials are absent so callers can degrade instead of
 * throwing — the storefront must keep working without Admin access.
 */
export function getAdminConfig(weaverse: WeaverseClient): AdminConfig | null {
  const accessToken = weaverse.env?.PRIVATE_ADMIN_API_TOKEN;
  const shopDomain = weaverse.env?.PUBLIC_STORE_DOMAIN;
  if (!(accessToken && shopDomain)) {
    return null;
  }
  return {
    endpoint: `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    accessToken,
    weaverse,
  };
}

function requestInit(config: AdminConfig, query: string, variables?: unknown) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  };
}

/**
 * Read through the Hydrogen cache. Used for config-shaped data that changes
 * rarely, to avoid an Admin API round trip on every page render.
 */
export async function adminQueryCached<T>(
  config: AdminConfig,
  query: string,
  { maxAge = 300 }: { maxAge?: number } = {},
): Promise<T | null> {
  try {
    const response = await config.weaverse.fetchWithCache<AdminResponse<T>>(
      config.endpoint,
      {
        ...requestInit(config, query),
        strategy: CacheCustom({ mode: "private", maxAge }),
      },
    );
    if (response?.errors?.length) {
      console.error("Shopify Admin query error:", response.errors[0].message);
      return null;
    }
    return response?.data ?? null;
  } catch (error) {
    console.error("Shopify Admin query failed:", error);
    return null;
  }
}

/** Uncached write. Never cache a mutation. */
export async function adminMutate<T>(
  config: AdminConfig,
  mutation: string,
  variables: unknown,
): Promise<T | null> {
  try {
    const response = await fetch(
      config.endpoint,
      requestInit(config, mutation, variables),
    );
    const json = (await response.json()) as AdminResponse<T>;
    if (json?.errors?.length) {
      console.error("Shopify Admin mutation error:", json.errors[0].message);
      return null;
    }
    return json?.data ?? null;
  } catch (error) {
    console.error("Shopify Admin mutation failed:", error);
    return null;
  }
}
