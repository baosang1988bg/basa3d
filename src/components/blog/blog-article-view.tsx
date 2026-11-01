// Phase 54.2 (ADR-0057): one renderer for the public post page AND the admin review preview, so
// what the reviewer approves is exactly what readers see.
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MARKDOWN_PROSE_CLASSES } from '@/lib/markdown';
import { selectedMedia, youtubeEmbedUrl, type BlogMediaItem, type YoutubeMedia } from '@/lib/blog-media';
import { SourceImageCard } from './source-media';

export interface BlogArticleViewProps {
  title: string;
  dateLabel: string;
  coverImageUrl: string | null;
  content: string;
  tags: string[];
  media: BlogMediaItem[];
}

function YoutubeEmbed({ video }: { video: YoutubeMedia }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="aspect-video overflow-hidden rounded-xl bg-muted">
        <iframe
          src={youtubeEmbedUrl(video.videoId)}
          title={video.caption ?? `Video từ ${video.sourceName}`}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Video được nhắc tới trong bài của{' '}
        <a href={video.sourceUrl} target="_blank" rel="nofollow noopener noreferrer" className="font-medium text-primary hover:underline">{video.sourceName} ↗</a>
      </figcaption>
    </figure>
  );
}

export function BlogArticleView({ title, dateLabel, coverImageUrl, content, tags, media }: BlogArticleViewProps) {
  const { images, videos } = selectedMedia(media);
  // Hero: the uploaded cover if any; otherwise the first source image as a captioned card.
  const heroImage = coverImageUrl ? null : images[0];
  const galleryImages = heroImage ? images.slice(1) : images;

  return (
    <>
      {coverImageUrl && (
        <div className="aspect-video overflow-hidden rounded-xl bg-muted/50">
          <Image src={coverImageUrl} alt={title} width={800} height={450} className="size-full object-cover" priority />
        </div>
      )}
      {heroImage && (
        <SourceImageCard url={heroImage.url} caption={heroImage.caption} sourceName={heroImage.sourceName} sourceUrl={heroImage.sourceUrl} large />
      )}

      <h1 className="font-heading mt-6 text-2xl font-bold text-foreground md:text-[2rem]">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{dateLabel}</p>

      <div className={`mt-6 text-base text-foreground ${MARKDOWN_PROSE_CLASSES}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {(videos.length > 0 || galleryImages.length > 0) && (
        <section className="mt-10 flex flex-col gap-4" aria-labelledby="blog-source-media">
          <h2 id="blog-source-media" className="font-heading text-lg font-semibold text-foreground">Video &amp; hình ảnh từ nguồn tin</h2>
          {videos.map((video) => <YoutubeEmbed key={video.id} video={video} />)}
          {galleryImages.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {galleryImages.map((image) => (
                <SourceImageCard key={image.id} url={image.url} caption={image.caption} sourceName={image.sourceName} sourceUrl={image.sourceUrl} />
              ))}
            </div>
          )}
        </section>
      )}

      {tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">#{tag}</span>
          ))}
        </div>
      )}
    </>
  );
}
