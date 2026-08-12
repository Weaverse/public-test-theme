import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useEffect } from "react";
import { Icon } from "~/components/icon";
import { Image } from "~/components/image";
import type { InstagramItem } from "~/types/instagram";
import { cn } from "~/utils/cn";

export function InstagramLightbox({
  items,
  activeIndex,
  setActiveIndex,
  open,
  onOpenChange,
}: {
  items: InstagramItem[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const total = items.length;
  const activeItem = items[activeIndex];
  const hasSiblings = total > 1;

  function goTo(offset: number) {
    // Wrap around at both ends.
    setActiveIndex((activeIndex + offset + total) % total);
  }

  useEffect(() => {
    if (!(open && hasSiblings)) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        setActiveIndex((activeIndex + 1 + total) % total);
      } else if (event.key === "ArrowLeft") {
        setActiveIndex((activeIndex - 1 + total) % total);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasSiblings, activeIndex, total, setActiveIndex]);

  if (!activeItem) {
    return null;
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-10 bg-black/90 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-10 w-screen"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>Instagram post viewer</Dialog.Title>
          </VisuallyHidden.Root>
          <div className="relative flex h-full w-full flex-col items-center justify-center p-4 md:p-10">
            <InstagramLightboxMedia item={activeItem} />

            <div className="mt-4 max-w-2xl space-y-2 text-center text-white">
              {activeItem.caption && (
                <p className="line-clamp-3 text-sm opacity-90">
                  {activeItem.caption}
                </p>
              )}
              <a
                className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4 hover:opacity-80"
                href={activeItem.permalink}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on Instagram
                <Icon className="h-4 w-4" name="arrow-square-out" />
              </a>
            </div>

            <Dialog.Close
              aria-label="Close"
              className="absolute top-4 right-4 z-1 cursor-pointer p-2 text-white hover:opacity-70"
            >
              <Icon className="h-6 w-6" name="x" />
            </Dialog.Close>

            {hasSiblings && (
              <>
                <button
                  aria-label="Previous post"
                  className={cn(
                    "-translate-y-1/2 absolute top-1/2 left-2 md:left-6",
                    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full",
                    "bg-white/15 text-white transition-colors hover:bg-white/30",
                  )}
                  onClick={() => goTo(-1)}
                  type="button"
                >
                  <Icon className="h-5 w-5" name="caret-left" />
                </button>
                <button
                  aria-label="Next post"
                  className={cn(
                    "-translate-y-1/2 absolute top-1/2 right-2 md:right-6",
                    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full",
                    "bg-white/15 text-white transition-colors hover:bg-white/30",
                  )}
                  onClick={() => goTo(1)}
                  type="button"
                >
                  <Icon className="h-5 w-5" name="caret-right" />
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InstagramLightboxMedia({ item }: { item: InstagramItem }) {
  if (item.type === "VIDEO") {
    return (
      // `key` forces a fresh element per post so the previous video stops and
      // the new source actually loads when navigating with the arrows.
      <video
        autoPlay
        className="max-h-[70vh] w-auto max-w-full object-contain"
        controls
        key={item.id}
        playsInline
        poster={item.displayUrl}
      >
        <track kind="captions" />
        <source src={item.mediaUrl} type="video/mp4" />
      </video>
    );
  }
  // The theme's Image forces `object-cover` on a full-size box, which would
  // crop the post — override the inner <img> with child selectors so it shows
  // whole. Carousels only expose their first image here, so they show a still.
  return (
    <Image
      alt={item.caption || "Instagram post"}
      className={cn(
        "h-auto max-h-[70vh] w-auto max-w-full rounded-none",
        "[&_img]:h-auto [&_img]:max-h-[70vh] [&_img]:w-auto",
        "[&_img]:max-w-full [&_img]:object-contain",
      )}
      sizes="(min-width: 48em) 80vw, 100vw"
      src={item.mediaUrl}
    />
  );
}
