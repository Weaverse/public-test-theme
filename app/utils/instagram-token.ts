import type { WeaverseClient } from "@weaverse/hydrogen";
import type { AdminConfig } from "./shopify-admin";
import { adminMutate, adminQueryCached, getAdminConfig } from "./shopify-admin";

const METAFIELD_NAMESPACE = "instagram";
const METAFIELD_KEY = "access_token";

const DAY_MS = 86_400_000;
/** Refresh once the token has less than this long to live. */
const REFRESH_WINDOW_MS = 7 * DAY_MS;
/** Instagram rejects refreshes on tokens under 24h old, so back off between tries. */
const ATTEMPT_THROTTLE_MS = DAY_MS;

/** Shape stored in the shop metafield. */
type StoredToken = {
  token: string;
  /** Epoch ms when the token expires, or null while still unknown. */
  expiresAt: number | null;
  /** Epoch ms of the last refresh attempt, successful or not. */
  lastAttemptAt: number;
};

type ShopMetafieldQuery = {
  shop: { id: string; metafield: { value: string } | null };
};

const READ_QUERY = `#graphql
  query InstagramToken {
    shop {
      id
      metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
        value
      }
    }
  }
`;

const WRITE_MUTATION = `#graphql
  mutation SetInstagramToken($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

function parseStored(value: string | undefined): StoredToken | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<StoredToken>;
    if (typeof parsed.token !== "string" || !parsed.token) {
      return null;
    }
    return {
      token: parsed.token,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
      lastAttemptAt:
        typeof parsed.lastAttemptAt === "number" ? parsed.lastAttemptAt : 0,
    };
  } catch {
    return null;
  }
}

async function writeStored(
  config: AdminConfig,
  shopId: string,
  stored: StoredToken,
) {
  const result = await adminMutate<{
    metafieldsSet: { userErrors: { field: string[]; message: string }[] };
  }>(config, WRITE_MUTATION, {
    metafields: [
      {
        ownerId: shopId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEY,
        type: "json",
        value: JSON.stringify(stored),
      },
    ],
  });
  const userErrors = result?.metafieldsSet?.userErrors;
  if (userErrors?.length) {
    console.error("Could not store Instagram token:", userErrors[0].message);
  }
}

/**
 * Ask Instagram for a fresh 60-day token.
 * Returns null when the call fails — for example on a token under 24h old.
 */
async function requestRefreshedToken(
  token: string,
): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const response = await fetch(
      "https://graph.instagram.com/refresh_access_token" +
        `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    );
    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
    if (json?.access_token && typeof json.expires_in === "number") {
      return { token: json.access_token, expiresIn: json.expires_in };
    }
    console.error(
      "Instagram token refresh rejected:",
      json?.error?.message || "unexpected response",
    );
    return null;
  } catch (error) {
    console.error("Instagram token refresh failed:", error);
    return null;
  }
}

export function shouldRefresh(
  stored: StoredToken | null,
  now: number,
): boolean {
  // Nothing stored yet — refresh to establish a known expiry date.
  if (!stored) {
    return true;
  }
  // Back off so a persistently failing refresh cannot hammer the API.
  if (now - stored.lastAttemptAt < ATTEMPT_THROTTLE_MS) {
    return false;
  }
  if (stored.expiresAt === null) {
    return true;
  }
  return stored.expiresAt - now < REFRESH_WINDOW_MS;
}

/**
 * Refresh and persist. Records the attempt either way so a failing token backs
 * off for a day instead of retrying on every request.
 */
async function refreshAndStore(
  config: AdminConfig,
  shopId: string,
  currentToken: string,
  stored: StoredToken | null,
) {
  const now = Date.now();
  const refreshed = await requestRefreshedToken(currentToken);
  await writeStored(config, shopId, {
    token: refreshed?.token ?? currentToken,
    expiresAt: refreshed
      ? now + refreshed.expiresIn * 1000
      : (stored?.expiresAt ?? null),
    lastAttemptAt: now,
  });
}

/**
 * Resolve the Instagram access token, rotating it in the background when it
 * nears expiry.
 *
 * Storage is a shop metafield, because Oxygen environment variables cannot be
 * written at runtime. Without Admin API credentials this simply returns the
 * environment token and no rotation happens.
 */
export async function getInstagramToken(
  weaverse: WeaverseClient,
): Promise<string | null> {
  const envToken = weaverse.env?.INSTAGRAM_ACCESS_TOKEN || null;
  const config = getAdminConfig(weaverse);
  if (!config) {
    return envToken;
  }

  const data = await adminQueryCached<ShopMetafieldQuery>(config, READ_QUERY);
  const shopId = data?.shop?.id;
  if (!shopId) {
    // Admin API unreachable or lacking scope — fall back to the static token.
    return envToken;
  }

  const stored = parseStored(data.shop.metafield?.value);
  // The metafield wins once seeded; the env var is only the starting value.
  const currentToken = stored?.token || envToken;
  if (!currentToken) {
    return null;
  }

  if (shouldRefresh(stored, Date.now())) {
    // Rotate after the response is sent so rendering is never blocked.
    weaverse.waitUntil?.(refreshAndStore(config, shopId, currentToken, stored));
  }

  return currentToken;
}
