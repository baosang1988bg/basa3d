// Phase 54.2 (ADR-0057): media attached to a blog post, stored in blog_posts.media (jsonb).
// - source_image: a preview image HOTLINKED from the cited article (og:image / RSS media), always
//   shown as a captioned card linking back to the source — never downloaded or re-hosted.
// - youtube: an embed of a video referenced by the source article (youtube-nocookie player).
// Shared by the ingest pipeline, admin review page and public renderer.
import { z } from 'zod';

export const MAX_BLOG_MEDIA_ITEMS = 20;

const httpsUrl = z.string().trim().max(1000).url().refine((value) => value.startsWith('https://'), 'must be https');
const mediaId = z.string().regex(/^[a-f0-9]{12}$/);
const sourceName = z.string().trim().min(1).max(80);
const caption = z.string().trim().max(300).optional();

export const youtubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

export const blogMediaItemSchema = z.discriminatedUnion('kind', [
  z.object({ id: mediaId, kind: z.literal('source_image'), url: httpsUrl, sourceUrl: httpsUrl, sourceName, caption, selected: z.boolean() }),
  z.object({ id: mediaId, kind: z.literal('youtube'), videoId: youtubeVideoIdSchema, sourceUrl: httpsUrl, sourceName, caption, selected: z.boolean() }),
]);

export const blogMediaListSchema = z.array(blogMediaItemSchema).max(MAX_BLOG_MEDIA_ITEMS);

export type BlogMediaItem = z.infer<typeof blogMediaItemSchema>;
export type SourceImageMedia = Extract<BlogMediaItem, { kind: 'source_image' }>;
export type YoutubeMedia = Extract<BlogMediaItem, { kind: 'youtube' }>;

/**
 * Lenient read for rendering: drops any item that fails validation instead of failing the page
 * (a malformed row must never take a published article down).
 */
export function parseStoredBlogMedia(value: unknown): BlogMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => blogMediaItemSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data as BlogMediaItem)
    .slice(0, MAX_BLOG_MEDIA_ITEMS);
}

export function selectedMedia(media: BlogMediaItem[]) {
  const items = media.filter((item) => item.selected);
  return {
    videos: items.filter((item): item is YoutubeMedia => item.kind === 'youtube'),
    images: items.filter((item): item is SourceImageMedia => item.kind === 'source_image'),
  };
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/** First selected source image — used only as a list thumbnail fallback when a post has no cover. */
export function firstSelectedImageUrl(media: unknown): string | null {
  return selectedMedia(parseStoredBlogMedia(media)).images[0]?.url ?? null;
}
