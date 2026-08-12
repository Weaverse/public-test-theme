import { type ComponentLoaderArgs, createSchema } from "@weaverse/hydrogen";
import { backgroundInputs } from "~/components/background-image";
import type { SectionProps } from "~/components/section";
import { layoutInputs, Section } from "~/components/section";
import { fetchInstagramMedia } from "~/utils/instagram";

interface InstagramFeedData {
  postsLimit: number;
}

interface InstagramFeedProps
  extends SectionProps<Awaited<ReturnType<typeof loader>>>,
    InstagramFeedData {
  ref?: React.Ref<HTMLElement>;
}

function InstagramFeed(props: InstagramFeedProps) {
  // `loaderData` and `postsLimit` are consumed by the loader and the carousel
  // child; pull them out so they don't land on the DOM node via `...rest`.
  const { children, loaderData, postsLimit, ref, ...rest } = props;
  return (
    <Section ref={ref} {...rest}>
      {children}
    </Section>
  );
}

export type InstagramFeedLoaderData = Awaited<ReturnType<typeof loader>>;

export const loader = async ({
  data,
  weaverse,
}: ComponentLoaderArgs<InstagramFeedData>) => {
  return await fetchInstagramMedia(weaverse, { limit: data?.postsLimit || 12 });
};

export default InstagramFeed;

export const schema = createSchema({
  type: "instagram-feed",
  title: "Instagram feed",
  settings: [
    {
      group: "Instagram",
      inputs: [
        {
          type: "range",
          name: "postsLimit",
          label: "Posts to show",
          configs: { min: 4, max: 24, step: 1 },
          defaultValue: 12,
          helpText:
            "Reads INSTAGRAM_ACCESS_TOKEN from the environment (INSTAGRAM_ACCOUNT_ID is optional).",
          shouldRevalidate: true,
        },
      ],
    },
    { group: "Layout", inputs: layoutInputs },
    { group: "Background", inputs: backgroundInputs },
  ],
  childTypes: [
    "heading",
    "subheading",
    "paragraph",
    "button",
    "instagram-feed--carousel",
  ],
  presets: {
    width: "stretch",
    verticalPadding: "large",
    gap: 32,
    children: [
      {
        type: "heading",
        content: "Follow us on Instagram",
        alignment: "center",
      },
      {
        type: "paragraph",
        content:
          'Tag <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">@yourbrand</a> for a chance to be featured.',
        alignment: "center",
      },
      { type: "instagram-feed--carousel" },
    ],
  },
});
