import {
  createSchema,
  type HydrogenComponentProps,
  useParentInstance,
} from "@weaverse/hydrogen";
import { useState } from "react";
import { useNavigation } from "react-router";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { Icon } from "~/components/icon";
import { useWeaverseStudioCheck } from "~/hooks/use-weaverse-studio-check";
import { cn } from "~/utils/cn";
import type { InstagramFeedLoaderData } from ".";
import { InstagramLightbox } from "./lightbox";
import { InstagramMediaCard } from "./media-card";

const SKELETON_COUNT = 6;

/** Coerce an editor value, keeping a deliberate 0 instead of falling back. */
function num(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const ARROW_CLASSNAME = cn(
  "pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center",
  "rounded-full border border-current bg-white text-black transition-colors",
  "hover:bg-black hover:text-white",
  // Swiper adds this class at the ends of the rail when looping is off.
  "disabled:cursor-default disabled:opacity-40",
);

interface InstagramFeedCarouselProps extends HydrogenComponentProps {
  gap: number;
  mobileGap: number;
  mobileSlidesPerView: number;
  desktopSlidesPerView: number;
  aspectRatio: string;
  clickBehavior: "instagram" | "lightbox";
  showArrows: boolean;
  showDots: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

function StateMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-body-subtle">
      {children}
    </div>
  );
}

function InstagramFeedCarousel(props: InstagramFeedCarouselProps) {
  const {
    children,
    gap,
    mobileGap,
    mobileSlidesPerView,
    desktopSlidesPerView,
    aspectRatio,
    clickBehavior,
    showArrows,
    showDots,
    ref,
    ...rest
  } = props;

  const parent = useParentInstance();
  const loaderData: InstagramFeedLoaderData = parent.data?.loaderData;
  const items = loaderData?.items || [];
  const error = loaderData?.error || null;

  const navigation = useNavigation();
  const isDesignMode = useWeaverseStudioCheck();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Posts are fetched server-side, so there is no loading flash on first paint.
  // This only covers revalidation — e.g. changing "Posts to show" in the editor.
  if (navigation.state === "loading") {
    return (
      <div ref={ref} {...rest} className="w-full">
        <div className="flex" style={{ gap: `${num(gap, 24)}px` }}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <div
              className="shrink-0 animate-pulse rounded-md bg-gray-200"
              key={`instagram-skeleton-${index}`}
              style={{
                aspectRatio,
                width: `calc((100% - ${num(gap, 24) * (SKELETON_COUNT - 1)}px) / ${SKELETON_COUNT})`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    // Shoppers get nothing; editors get the actual reason.
    if (!isDesignMode) {
      return null;
    }
    return (
      <div ref={ref} {...rest} className="w-full">
        <StateMessage>
          <Icon className="h-6 w-6" name="warning-circle" />
          <p className="text-sm">{error}</p>
        </StateMessage>
      </div>
    );
  }

  if (!items.length) {
    // Collapse on the storefront rather than leaving an empty gap.
    if (!isDesignMode) {
      return null;
    }
    return (
      <div ref={ref} {...rest} className="w-full">
        <StateMessage>
          <Icon className="h-6 w-6" name="instagram-logo" />
          <p className="text-sm">No Instagram posts to show yet.</p>
        </StateMessage>
      </div>
    );
  }

  const useLightbox = clickBehavior === "lightbox";

  return (
    <div
      // Swiper reads these options once on init, so remount it when the editor
      // changes them.
      key={[
        mobileSlidesPerView,
        desktopSlidesPerView,
        gap,
        mobileGap,
        aspectRatio,
        items.length,
      ].join("-")}
      ref={ref}
      {...rest}
      // Must come after {...rest}: Weaverse passes its own className, which
      // would otherwise overwrite `relative` and break arrow positioning.
      className="group relative w-full"
    >
      <Swiper
        breakpoints={{
          320: {
            slidesPerView: num(mobileSlidesPerView, 2.5),
            spaceBetween: num(mobileGap, 16),
          },
          768: {
            slidesPerView: num(desktopSlidesPerView, 5.5),
            spaceBetween: num(gap, 24),
          },
        }}
        className="instagram-feed-swiper"
        modules={[Navigation, Pagination]}
        navigation={
          showArrows
            ? { nextEl: ".instagram-feed-next", prevEl: ".instagram-feed-prev" }
            : false
        }
        pagination={
          showDots ? { el: ".instagram-feed-dots", clickable: true } : false
        }
        slidesPerView={num(desktopSlidesPerView, 5.5)}
        spaceBetween={num(gap, 24)}
      >
        {items.map((item, index) => (
          <SwiperSlide className="!h-auto" key={item.id}>
            <InstagramMediaCard
              aspectRatio={aspectRatio}
              item={item}
              onOpen={useLightbox ? () => setOpenIndex(index) : undefined}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {showArrows && (
        // Hidden on mobile: at that size the buttons cover the edge tiles and
        // swallow taps on them, and swiping is the natural gesture there.
        <div className="pointer-events-none absolute top-1/2 left-0 z-10 hidden w-full -translate-y-1/2 items-center justify-between px-2 md:flex md:px-4">
          <button
            aria-label="Previous posts"
            className={cn(ARROW_CLASSNAME, "instagram-feed-prev")}
            type="button"
          >
            <Icon className="h-5 w-5" name="caret-left" />
          </button>
          <button
            aria-label="Next posts"
            className={cn(ARROW_CLASSNAME, "instagram-feed-next")}
            type="button"
          >
            <Icon className="h-5 w-5" name="caret-right" />
          </button>
        </div>
      )}

      {showDots && (
        <div className="mt-6 flex items-center justify-center">
          <div className="instagram-feed-dots flex gap-2" />
        </div>
      )}

      {useLightbox && (
        <InstagramLightbox
          activeIndex={openIndex ?? 0}
          items={items}
          onOpenChange={(open) => setOpenIndex(open ? (openIndex ?? 0) : null)}
          open={openIndex !== null}
          setActiveIndex={setOpenIndex}
        />
      )}
    </div>
  );
}

export default InstagramFeedCarousel;

export const schema = createSchema({
  type: "instagram-feed--carousel",
  title: "Posts carousel",
  settings: [
    {
      group: "Carousel",
      inputs: [
        {
          type: "select",
          name: "clickBehavior",
          label: "On click",
          configs: {
            options: [
              { value: "instagram", label: "Open post on Instagram" },
              { value: "lightbox", label: "Open lightbox on this page" },
            ],
          },
          defaultValue: "instagram",
          helpText:
            "The lightbox shows the full photo and plays videos without leaving the site.",
        },
        {
          type: "select",
          name: "aspectRatio",
          label: "Tile aspect ratio",
          configs: {
            options: [
              { value: "1/1", label: "Square (1:1)" },
              { value: "4/5", label: "Portrait (4:5)" },
              { value: "9/16", label: "Vertical (9:16)" },
            ],
          },
          defaultValue: "4/5",
          helpText:
            "Posts have different native ratios, so every tile is cropped to this one.",
        },
        {
          type: "range",
          name: "mobileSlidesPerView",
          label: "Slides per view (mobile)",
          configs: { min: 1, max: 4, step: 0.5 },
          defaultValue: 2.5,
        },
        {
          type: "range",
          name: "desktopSlidesPerView",
          label: "Slides per view (desktop)",
          configs: { min: 2, max: 8, step: 0.5 },
          defaultValue: 5.5,
        },
        {
          type: "range",
          name: "mobileGap",
          label: "Gap (mobile)",
          configs: { min: 0, max: 48, step: 4, unit: "px" },
          defaultValue: 16,
        },
        {
          type: "range",
          name: "gap",
          label: "Gap (desktop)",
          configs: { min: 0, max: 48, step: 4, unit: "px" },
          defaultValue: 24,
        },
        {
          type: "switch",
          name: "showArrows",
          label: "Show arrows",
          defaultValue: true,
        },
        {
          type: "switch",
          name: "showDots",
          label: "Show dots",
          defaultValue: false,
        },
      ],
    },
  ],
});
