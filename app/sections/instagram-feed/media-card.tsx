import { Icon } from "~/components/icon";
import { Image } from "~/components/image";
import type { InstagramItem } from "~/types/instagram";
import { cn } from "~/utils/cn";

function mediaLabel(item: InstagramItem) {
  if (item.type === "VIDEO") {
    return "video";
  }
  return item.type === "CAROUSEL_ALBUM" ? "photo album" : "photo";
}

/** Overlay badge marking posts that hold more than a single still image. */
function TypeBadge({ type }: { type: InstagramItem["type"] }) {
  if (type === "IMAGE") {
    return null;
  }
  return (
    <span className="absolute top-3 right-3 flex items-center justify-center rounded-full bg-black/55 p-1.5 text-white">
      <Icon
        className="h-4 w-4"
        name={type === "VIDEO" ? "play" : "squares-four"}
      />
    </span>
  );
}

function CardContents({ item }: { item: InstagramItem }) {
  return (
    <>
      <Image
        alt={item.caption || `Instagram ${mediaLabel(item)}`}
        // This theme's Image has no `imageClassName`, so the inner <img> is
        // targeted with a child selector instead.
        className={cn(
          "h-full w-full",
          "[&_img]:transition-transform [&_img]:duration-500",
          "group-hover/card:[&_img]:scale-105",
        )}
        loading="lazy"
        sizes="(min-width: 64em) 20vw, (min-width: 48em) 33vw, 50vw"
        src={item.displayUrl}
      />
      <TypeBadge type={item.type} />
    </>
  );
}

const CARD_CLASSNAME =
  "group/card relative block w-full cursor-pointer overflow-hidden rounded-md bg-gray-100";

export function InstagramMediaCard({
  item,
  aspectRatio,
  onOpen,
}: {
  item: InstagramItem;
  aspectRatio: string;
  /** When omitted the card links straight to Instagram instead of opening a lightbox. */
  onOpen?: () => void;
}) {
  const label = item.caption
    ? `${item.caption.slice(0, 80)} — Instagram ${mediaLabel(item)}`
    : `Instagram ${mediaLabel(item)}`;

  if (onOpen) {
    return (
      <button
        aria-label={`Open ${label}`}
        className={CARD_CLASSNAME}
        onClick={onOpen}
        style={{ aspectRatio }}
        type="button"
      >
        <CardContents item={item} />
      </button>
    );
  }

  return (
    <a
      aria-label={`View ${label} on Instagram`}
      className={cn(CARD_CLASSNAME, "focus-visible:outline-2")}
      href={item.permalink}
      rel="noopener noreferrer"
      style={{ aspectRatio }}
      target="_blank"
    >
      <CardContents item={item} />
    </a>
  );
}
