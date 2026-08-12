import { CacheCustom } from "@shopify/hydrogen";
import type { WeaverseClient } from "@weaverse/hydrogen";
import type {
  InstagramApiMedia,
  InstagramApiMediaChild,
  InstagramApiResponse,
  InstagramFeedResult,
  InstagramItem,
  InstagramMedia,
  InstagramMediaType,
  InstagramSortOrder,
} from "~/types/instagram";
import { getInstagramToken } from "./instagram-token";

/**
 * Instagram API with Instagram Login. The access token is issued against an
 * Instagram app and carries `instagram_business_*` scopes, so it must be sent
 * to `graph.instagram.com` — `graph.facebook.com` rejects this token type.
 */
const GRAPH_API_HOST = "https://graph.instagram.com";
const GRAPH_API_VERSION = "v23.0";
const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "permalink",
  "thumbnail_url",
  "timestamp",
  // Album slides. Non-album posts simply omit the field.
  "children{id,media_type,media_url,thumbnail_url}",
].join(",");

const ALL_MEDIA_TYPES: InstagramMediaType[] = [
  "IMAGE",
  "VIDEO",
  "CAROUSEL_ALBUM",
];

/**
 * With a type filter on, the newest N posts may not contain N matches, so ask
 * for a wider window and trim after filtering. 100 is the Graph API ceiling.
 */
const OVERFETCH_FACTOR = 3;
const MAX_API_LIMIT = 100;

/**
 * Instagram CDN URLs are signed and expire within hours, so the response can
 * only be cached briefly — a long TTL would serve dead image links.
 */
const CACHE_STRATEGY = CacheCustom({
  mode: "public",
  maxAge: 3600,
  staleWhileRevalidate: 43_200,
});

/** Generic message: never surface API internals or token details to shoppers. */
const GENERIC_ERROR = "Instagram posts are unavailable right now.";

/**
 * A video's `media_url` is the MP4, so the tile has to use `thumbnail_url`.
 * Images and carousels have no thumbnail and use `media_url` directly.
 */
function toInstagramMedia(
  media: InstagramApiMedia | InstagramApiMediaChild,
): InstagramMedia | null {
  const displayUrl =
    media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;

  // Skip anything we cannot actually render.
  if (!displayUrl) {
    return null;
  }

  return {
    id: media.id,
    type: media.media_type,
    displayUrl,
    mediaUrl: media.media_url || displayUrl,
  };
}

function toInstagramItem(media: InstagramApiMedia): InstagramItem | null {
  const cover = toInstagramMedia(media);

  if (!(cover && media.permalink)) {
    return null;
  }

  return {
    ...cover,
    caption: media.caption || "",
    permalink: media.permalink,
    timestamp: media.timestamp || "",
    children: (media.children?.data || [])
      .map(toInstagramMedia)
      .filter((child): child is InstagramMedia => child !== null),
  };
}

/** Fisher–Yates. Runs in the loader, so the client gets one stable order. */
function shuffle(items: InstagramItem[]): InstagramItem[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sorting is applied *after* the list is trimmed, so switching order reshuffles
 * the same posts instead of swapping in a different set.
 */
function sortItems(
  items: InstagramItem[],
  order: InstagramSortOrder,
): InstagramItem[] {
  if (order === "random") {
    return shuffle(items);
  }
  // The API returns newest first, so reversing gives oldest first.
  return order === "oldest" ? [...items].reverse() : items;
}

/**
 * Fetch recent media for the configured account.
 *
 * Never throws — a missing config, an expired token or a network failure all
 * resolve to an empty list plus an `error` message the UI can render.
 */
export async function fetchInstagramMedia(
  weaverse: WeaverseClient,
  {
    limit = 12,
    mediaTypes,
    sortOrder = "newest",
  }: {
    limit?: number;
    /** Types to keep. Empty or omitted means every type. */
    mediaTypes?: InstagramMediaType[];
    sortOrder?: InstagramSortOrder;
  } = {},
): Promise<InstagramFeedResult> {
  // Resolves the rotating token from the shop metafield when Admin API
  // credentials exist, otherwise the static env var.
  const accessToken = await getInstagramToken(weaverse);

  if (!accessToken) {
    return {
      items: [],
      error: "Instagram is not configured. Set INSTAGRAM_ACCESS_TOKEN.",
    };
  }

  // The token already identifies one account, so `me` is enough. An explicit
  // INSTAGRAM_ACCOUNT_ID is honoured when set.
  const accountId = weaverse.env?.INSTAGRAM_ACCOUNT_ID || "me";

  const allowedTypes = mediaTypes?.length ? mediaTypes : ALL_MEDIA_TYPES;
  const isFiltered = allowedTypes.length < ALL_MEDIA_TYPES.length;
  const fetchLimit = Math.min(
    isFiltered ? limit * OVERFETCH_FACTOR : limit,
    MAX_API_LIMIT,
  );

  const url =
    `${GRAPH_API_HOST}/${GRAPH_API_VERSION}/${accountId}/media` +
    `?fields=${MEDIA_FIELDS}&limit=${fetchLimit}` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  let response: InstagramApiResponse | null = null;
  try {
    response = await weaverse.fetchWithCache<InstagramApiResponse>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      strategy: CACHE_STRATEGY,
    });
  } catch (error) {
    console.error("Instagram media fetch failed:", error);
    return { items: [], error: GENERIC_ERROR };
  }

  // `fetchWithCache` swallows non-2xx responses and resolves to undefined, so
  // an absent body means the request failed — not that the account is empty.
  if (!response) {
    console.error(
      "Instagram request failed (no response body). Check INSTAGRAM_ACCESS_TOKEN " +
        `and that INSTAGRAM_ACCOUNT_ID is an Instagram user id, not an app id. Requested account: "${accountId}".`,
    );
    return { items: [], error: GENERIC_ERROR };
  }

  // The Graph API can also return an `error` body with a 200.
  if (response.error) {
    console.error(
      `Instagram API error (${response.error.code}): ${response.error.message}`,
    );
    return { items: [], error: GENERIC_ERROR };
  }

  if (!Array.isArray(response.data)) {
    console.error(
      "Instagram response contained no media array:",
      JSON.stringify(response).slice(0, 300),
    );
    return { items: [], error: GENERIC_ERROR };
  }

  const items = response.data
    .map(toInstagramItem)
    .filter((item): item is InstagramItem => item !== null)
    .filter((item) => allowedTypes.includes(item.type))
    .slice(0, limit);

  return { items: sortItems(items, sortOrder), error: null };
}
