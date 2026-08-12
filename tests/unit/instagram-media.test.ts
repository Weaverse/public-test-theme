import { expect, test } from "@playwright/test";
import { fetchInstagramMedia } from "../../app/utils/instagram";
import { shouldRefresh } from "../../app/utils/instagram-token";

const SAMPLE = {
  data: [
    {
      id: "1",
      media_type: "VIDEO",
      media_url: "https://scontent.cdninstagram.com/reel.mp4",
      thumbnail_url: "https://scontent.cdninstagram.com/reel.jpg",
      permalink: "https://instagram.com/p/1",
      caption: "A reel",
      timestamp: "2026-07-01T10:00:00+0000",
    },
    {
      id: "2",
      media_type: "IMAGE",
      media_url: "https://scontent.cdninstagram.com/photo.jpg",
      permalink: "https://instagram.com/p/2",
      caption: "A photo",
      timestamp: "2026-07-02T10:00:00+0000",
    },
    {
      id: "3",
      media_type: "CAROUSEL_ALBUM",
      media_url: "https://scontent.cdninstagram.com/album.jpg",
      permalink: "https://instagram.com/p/3",
      timestamp: "2026-07-03T10:00:00+0000",
    },
  ],
};

const FULL_ENV = {
  INSTAGRAM_ACCOUNT_ID: "17841400000000000",
  INSTAGRAM_ACCESS_TOKEN: "tok",
};

/** Minimal stub of WeaverseClient — only the fields the loader touches. */
type AnyClient = any;

function stubWeaverse(
  response: unknown,
  env: Record<string, string> = FULL_ENV,
): AnyClient {
  return { env, fetchWithCache: async () => response };
}

test("keeps all three media types", async () => {
  const { items, error } = await fetchInstagramMedia(stubWeaverse(SAMPLE));
  expect(error).toBeNull();
  expect(items.map((item) => [item.id, item.type])).toEqual([
    ["1", "VIDEO"],
    ["2", "IMAGE"],
    ["3", "CAROUSEL_ALBUM"],
  ]);
});

test("a video tile uses thumbnail_url and keeps media_url playable", async () => {
  const { items } = await fetchInstagramMedia(stubWeaverse(SAMPLE));
  expect(items[0].displayUrl).toBe(
    "https://scontent.cdninstagram.com/reel.jpg",
  );
  expect(items[0].mediaUrl).toBe("https://scontent.cdninstagram.com/reel.mp4");
});

test("images and carousels display media_url", async () => {
  const { items } = await fetchInstagramMedia(stubWeaverse(SAMPLE));
  expect(items[1].displayUrl).toBe(items[1].mediaUrl);
  expect(items[2].displayUrl).toBe(
    "https://scontent.cdninstagram.com/album.jpg",
  );
});

test("calls graph.instagram.com, not graph.facebook.com", async () => {
  let requestedUrl = "";
  const weaverse: AnyClient = {
    env: FULL_ENV,
    fetchWithCache: async (url: string) => {
      requestedUrl = url;
      return SAMPLE;
    },
  };
  await fetchInstagramMedia(weaverse);
  expect(requestedUrl).toContain("https://graph.instagram.com/");
  expect(requestedUrl).toContain(`/${FULL_ENV.INSTAGRAM_ACCOUNT_ID}/media`);
});

test("falls back to /me/media when no account id is set", async () => {
  let requestedUrl = "";
  const weaverse: AnyClient = {
    env: { INSTAGRAM_ACCESS_TOKEN: "tok" },
    fetchWithCache: async (url: string) => {
      requestedUrl = url;
      return SAMPLE;
    },
  };
  await fetchInstagramMedia(weaverse);
  expect(requestedUrl).toContain("/me/media");
});

test("reports a config error when the token is missing", async () => {
  const { items, error } = await fetchInstagramMedia(
    stubWeaverse(SAMPLE, { INSTAGRAM_ACCOUNT_ID: "178414" }),
  );
  expect(items).toEqual([]);
  expect(error).toMatch(/not configured/i);
});

test("reports an error when the API returns an expired token", async () => {
  const { items, error } = await fetchInstagramMedia(
    stubWeaverse({
      error: { message: "Session expired", type: "OAuthException", code: 190 },
    }),
  );
  expect(items).toEqual([]);
  // The shopper-facing message must not leak API internals.
  expect(error).not.toMatch(/OAuthException|token/i);
});

test("treats a swallowed failed request as an error, not an empty feed", async () => {
  // fetchWithCache resolves to undefined when the HTTP request fails.
  const weaverse: AnyClient = {
    env: FULL_ENV,
    fetchWithCache: async () => undefined,
  };
  const { items, error } = await fetchInstagramMedia(weaverse);
  expect(items).toEqual([]);
  expect(error).toBeTruthy();
});

test("skips entries with no usable media URL", async () => {
  const { items, error } = await fetchInstagramMedia(
    stubWeaverse({
      data: [
        {
          id: "5",
          media_type: "IMAGE",
          permalink: "https://instagram.com/p/5",
        },
      ],
    }),
  );
  expect(items).toEqual([]);
  // Nothing renderable came back, but the request itself succeeded.
  expect(error).toBeNull();
});

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

test("refreshes the token only when it is near expiry", () => {
  expect(shouldRefresh(null, NOW)).toBe(true);
  expect(
    shouldRefresh(
      { token: "t", expiresAt: NOW + 60 * DAY, lastAttemptAt: NOW - 2 * DAY },
      NOW,
    ),
  ).toBe(false);
  expect(
    shouldRefresh(
      { token: "t", expiresAt: NOW + 6 * DAY, lastAttemptAt: NOW - 2 * DAY },
      NOW,
    ),
  ).toBe(true);
});

test("backs off for a day between refresh attempts", () => {
  expect(
    shouldRefresh(
      { token: "t", expiresAt: null, lastAttemptAt: NOW - 3_600_000 },
      NOW,
    ),
  ).toBe(false);
  expect(
    shouldRefresh(
      { token: "t", expiresAt: null, lastAttemptAt: NOW - DAY - 1000 },
      NOW,
    ),
  ).toBe(true);
});
