'use client';

import { useState, type FormEvent } from 'react';
import { StorefrontButton } from '@/components/storefront/button';

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string };

export function CustomRequestForm() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: 'submitting' });
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: String(form.get('customerName') ?? ''),
      customerPhone: String(form.get('customerPhone') ?? ''),
      customerEmail: form.get('customerEmail') ? String(form.get('customerEmail')) : null,
      requestedMaterial: form.get('requestedMaterial') ? String(form.get('requestedMaterial')) : null,
      requestedColor: form.get('requestedColor') ? String(form.get('requestedColor')) : null,
      quantity: Number(form.get('quantity') ?? 1),
      attachmentUrl: form.get('attachmentUrl') ? String(form.get('attachmentUrl')) : null,
      description: String(form.get('description') ?? ''),
      honeypot: String(form.get('company-website') ?? ''),
    };

    try {
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 429) {
        const body = await response.json();
        setState({ status: 'error', message: body.message ?? 'Bạn đã gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.' });
        return;
      }
      if (!response.ok) {
        setState({ status: 'error', message: 'Có lỗi xảy ra, vui lòng thử lại.' });
        return;
      }
      setState({ status: 'success' });
      event.currentTarget.reset();
    } catch {
      setState({ status: 'error', message: 'Không thể kết nối máy chủ, vui lòng thử lại.' });
    }
  }

  if (state.status === 'success') {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading text-lg font-bold text-foreground">Đã gửi yêu cầu thành công!</p>
        <p className="mt-2 text-sm text-muted-foreground">Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để tư vấn và báo giá.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-2">
      {/* Honeypot: visually hidden from real users, bots typically fill every input they see. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="company-website">Company website</label>
        <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerName" className="text-sm font-medium text-foreground">Họ tên *</label>
        <input id="customerName" name="customerName" required maxLength={200} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerPhone" className="text-sm font-medium text-foreground">SĐT/Zalo *</label>
        <input id="customerPhone" name="customerPhone" required maxLength={30} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerEmail" className="text-sm font-medium text-foreground">Email</label>
        <input id="customerEmail" name="customerEmail" type="email" maxLength={320} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-medium text-foreground">Số lượng *</label>
        <input id="quantity" name="quantity" type="number" min={1} max={10000} required defaultValue={1} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedMaterial" className="text-sm font-medium text-foreground">Vật liệu mong muốn</label>
        <select id="requestedMaterial" name="requestedMaterial" className="h-10 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">
          <option value="">Chưa chắc chắn / tư vấn giúp tôi</option>
          <option value="PLA">PLA</option>
          <option value="PETG">PETG</option>
          <option value="ABS">ABS/ASA</option>
          <option value="TPU">TPU (dẻo)</option>
          <option value="RESIN">Resin</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedColor" className="text-sm font-medium text-foreground">Màu sắc mong muốn</label>
        <input id="requestedColor" name="requestedColor" maxLength={100} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="attachmentUrl" className="text-sm font-medium text-foreground">Link file/ảnh mẫu (Google Drive, Dropbox...)</label>
        <input id="attachmentUrl" name="attachmentUrl" type="url" maxLength={2000} placeholder="https://drive.google.com/..." className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground">Ghi chú chi tiết *</label>
        <textarea id="description" name="description" required maxLength={20000} rows={4} className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>

      {state.status === 'error' && <p className="text-sm text-destructive md:col-span-2">{state.message}</p>}

      <div className="md:col-span-2">
        <StorefrontButton type="submit" variant="accent" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Đang gửi...' : 'Gửi yêu cầu đặt in'}
        </StorefrontButton>
      </div>
    </form>
  );
}
