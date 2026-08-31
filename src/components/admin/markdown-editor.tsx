'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/components/ui/label';
import { MARKDOWN_PROSE_CLASSES } from '@/lib/markdown';

// Preview renders through react-markdown with no rehype-raw plugin, so raw HTML embedded in the
// markdown is never executed — safe by construction, no separate sanitizer needed (phase-7.md
// decision #1).

export function MarkdownEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={name}>Nội dung (Markdown) *</Label>
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab('edit')} className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ${tab === 'edit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            Soạn thảo
          </button>
          <button type="button" onClick={() => setTab('preview')} className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ${tab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            Xem trước
          </button>
        </div>
      </div>
      <textarea
        id={name}
        name={name}
        required
        rows={16}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        hidden={tab !== 'edit'}
        placeholder={'## Tiêu đề\n\nViết nội dung bằng Markdown — hỗ trợ **in đậm**, danh sách, bảng, ảnh `![alt](url)`...'}
        className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {tab === 'preview' ? (
        <div className={`rounded-lg border border-border bg-muted/20 p-4 text-sm ${MARKDOWN_PROSE_CLASSES}`}>
          {value.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown> : <p className="text-muted-foreground">Chưa có nội dung để xem trước.</p>}
        </div>
      ) : null}
    </div>
  );
}
