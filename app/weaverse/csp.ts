import type { HydrogenRouterContextProvider } from "@shopify/hydrogen";

export function getWeaverseCsp(
  request: Request,
  context: HydrogenRouterContextProvider,
) {
  const url = new URL(request.url);
  // Get weaverse host from query params
  const weaverseHost =
    url.searchParams.get("weaverseHost") || context.env.WEAVERSE_HOST;
  const isDesignMode = url.searchParams.get("weaverseHost");
  const weaverseHosts = ["*.weaverse.io", "*.shopify.com", "*.myshopify.com"];
  if (weaverseHost) {
    weaverseHosts.push(weaverseHost);
  }
  // Instagram media is served from Meta's CDN, not from graph.instagram.com.
  const instagramHosts = ["*.cdninstagram.com", "*.fbcdn.net"];
  const updatedCsp: {
    [x: string]: string[] | string | boolean;
  } = {
    defaultSrc: [
      "data:",
      "*.youtube.com",
      "*.youtu.be",
      "*.vimeo.com",
      "*.google.com",
      "*.google-analytics.com",
      "*.googletagmanager.com",
      "cdn.alireviews.io",
      "cdn.jsdelivr.net",
      "*.alicdn.com",
      ...weaverseHosts,
    ],
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      "cdn.shopify.com",
      ...instagramHosts,
      ...weaverseHosts,
    ],
    // Needed for Instagram video playback — without an explicit `media-src`,
    // <video> falls back to `default-src` and the MP4 is blocked.
    mediaSrc: [
      "'self'",
      "data:",
      "blob:",
      "cdn.shopify.com",
      ...instagramHosts,
    ],
    connectSrc: [
      "vimeo.com",
      "*.shopifysvc.com",
      "*.google-analytics.com",
      ...weaverseHosts,
    ],
    styleSrc: weaverseHosts,
    scriptSrc: ["https://cdn.shopify.com"],
  };
  if (isDesignMode) {
    updatedCsp.frameAncestors = ["*"];
  }
  return updatedCsp;
}
