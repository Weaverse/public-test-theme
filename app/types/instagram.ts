/**
 * Types for the Instagram API with Instagram Login (`graph.instagram.com`).
 *
 * The long-lived access token expires after 60 days and must be refreshed via
 * `GET /refresh_access_token?grant_type=ig_refresh_token` to stay valid.
 */

/** Raw `media_type` values returned by the Graph API. */
export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

/** Display order the merchant picks in the editor. */
export type InstagramSortOrder = "newest" | "oldest" | "random";

/**
 * One slide of a `CAROUSEL_ALBUM`, from the `children` edge. Children carry no
 * caption of their own — the caption belongs to the parent post.
 */
export type InstagramApiMediaChild = {
  id: string;
  media_type: InstagramMediaType;
  media_url?: string;
  thumbnail_url?: string;
};

/** A single entry from `GET /{instagram-account-id}/media`. */
export type InstagramApiMedia = {
  id: string;
  caption?: string;
  media_type: InstagramMediaType;
  /** Full-size image, or the MP4 for a video. Signed URL — expires within hours. */
  media_url?: string;
  /** Poster frame. Only present for videos. Also expires. */
  thumbnail_url?: string;
  permalink: string;
  timestamp?: string;
  /** Only returned for albums. */
  children?: { data?: InstagramApiMediaChild[] };
};

export type InstagramApiResponse = {
  data?: InstagramApiMedia[];
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

/** A renderable piece of media: a whole post, or one slide of an album. */
export type InstagramMedia = {
  id: string;
  type: InstagramMediaType;
  /** What a tile shows: `thumbnail_url` for video, `media_url` otherwise. */
  displayUrl: string;
  /** The original media. For a video this is the playable MP4. */
  mediaUrl: string;
};

/** A normalised post, safe to render. */
export type InstagramItem = InstagramMedia & {
  caption: string;
  permalink: string;
  timestamp: string;
  /** Album slides in order. Empty for single-image and video posts. */
  children: InstagramMedia[];
};

/**
 * Loader result. `error` is set when the feed could not be read at all, which
 * the UI shows differently from an account that simply has no posts.
 */
export type InstagramFeedResult = {
  items: InstagramItem[];
  error: string | null;
};
