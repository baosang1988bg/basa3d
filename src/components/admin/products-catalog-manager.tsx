'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Boxes,
  Check,
  ChevronDown,
  ExternalLink,
  ImageOff,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { ProductImagePicker, type PickedImage } from '@/components/admin/product-image-picker';
import { PublishBlockedNotice } from '@/components/admin/publish-blocked-notice';
import type { StaffRole } from '@/lib/auth/require-admin';
import { ProductImageUploadError, uploadProductImages } from '@/lib/uploads/product-image-upload';
import type {
  BulkCatalogResult,
  CatalogListItem,
  CatalogSortOption,
  CatalogSourceFilter,
  CatalogStatusFilter,
  PublishReadinessReason,
} from '@/services/product-onboarding.service';
import {
  bulkCatalogActionAction,
  createCategoryInlineAction,
  deleteCatalogProductAction,
  mergeCatalogProductsAction,
  quickUpdateCatalogProductAction,
} from '@/app/admin/(protected)/products/actions';
import { createProductOnboardingAction, publishProductAction } from '@/app/admin/(protected)/products/new/actions';

export type CatalogUiItem = CatalogListItem & {
  coverUrl: string | null;
  categoryLabel: string | null;
};

export type CatalogCategoryOption = {
  id: string;
  label: string;
  slug: string;
};

interface Props {
  items: CatalogUiItem[];
  categories: CatalogCategoryOption[];
  role: StaffRole;
  statusCounts: Record<CatalogStatusFilter, number>;
  page: number;
  hasNext: boolean;
  filters: {
    status?: CatalogStatusFilter;
    q?: string;
    type?: string;
    category?: string;
    source?: CatalogSourceFilter;
    sort?: CatalogSortOption;
  };
  publishBlocked?: string;
  missingNotice?: PublishReadinessReason[];
}

type ViewMode = 'list' | 'grid';
type NoticeState = {
  tone: 'ok' | 'warn' | 'error';
  title: string;
  details?: { label: string; reason: string }[];
};

const VIEW_MODE_STORAGE_KEY = 'basa3d_admin_products_view_v1';

const STATUS_TABS: { value: CatalogStatusFilter | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ACTIVE', label: 'Đang bán' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang bán', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  DRAFT: { label: 'Nháp', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  ARCHIVED: { label: 'Đã lưu trữ', className: 'border-border bg-muted text-muted-foreground' },
};

const LICENSE_OPTIONS = [
  { value: 'OWN_DESIGN', label: 'Tự thiết kế (BaSa3D)' },
  { value: 'COMMERCIAL_LICENSE', label: 'Đã mua Commercial License' },
  { value: 'CC_BY', label: 'CC BY (ghi công tác giả)' },
  { value: 'CC0', label: 'CC0 / Public Domain' },
  { value: 'OTHER', label: 'Khác (ghi rõ nguồn)' },
  { value: 'UNKNOWN', label: 'Chưa xác định (chỉ lưu nháp)' },
] as const;

const WARNING_LABELS: Record<string, string> = {
  UNIT_TOO_SMALL: 'Nghi sai đơn vị (nhỏ)',
  UNIT_TOO_LARGE: 'Nghi sai đơn vị (lớn)',
  MESH_NOT_WATERTIGHT: 'Mesh chưa kín',
  PARTS_OVERLAP: 'Chi tiết chồng nhau',
  UNPRICED: 'Chưa ước được giá',
  OVERSIZE_SKIPPED_PART: 'Có phần quá khổ',
};

function formatVnd(value: number | null): string {
  return value == null ? '—' : `${value.toLocaleString('vi-VN')}đ`;
}

function priceLabel(item: CatalogUiItem): string {
  if (item.minPrice !== null && item.maxPrice !== null && item.minPrice !== item.maxPrice) {
    return `${formatVnd(item.minPrice)} – ${formatVnd(item.maxPrice)}`;
  }
  return formatVnd(item.minPrice ?? item.basePrice);
}

const digitsOnly = (value: string) => value.replace(/[^\d]/g, '');

function needsStlApproval(item: CatalogUiItem): boolean {
  return item.imported && (item.importReviewStatus !== 'APPROVED' || !item.importLicenseReviewed);
}

export function ProductsCatalogManager({
  items,
  categories: initialCategories,
  role,
  statusCounts,
  page,
  hasNext,
  filters,
  publishBlocked,
  missingNotice = [],
}: Props) {
  const router = useRouter();
  const isOwner = role === 'OWNER';
  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => { setCategories(initialCategories); }, [initialCategories]);

  const realCategories = useMemo(
    () => categories.filter((c) => c.slug !== 'chua-phan-loai'),
    [categories],
  );
  const total = statusCounts.ACTIVE + statusCounts.DRAFT + statusCounts.ARCHIVED;

  // View mode (Card Grid default like D:\3D_Catalog, switchable to List)
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [draftTriage, setDraftTriage] = useState<'ALL' | 'READY' | 'NEEDS_LICENSE' | 'NEEDS_INFO'>('ALL');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'grid' || saved === 'list') setViewMode(saved);
    } catch {
      // ignore localStorage errors
    }
  }, []);
  function switchView(mode: ViewMode) {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode); } catch { /* ignore */ }
  }

  const triageCounts = useMemo(() => {
    let ready = 0;
    let needsLicense = 0;
    let needsInfo = 0;
    for (const item of items) {
      if (item.status !== 'DRAFT') continue;
      const onlyLicenseOrStl = item.missing.every((r) => r === 'LICENSE_UNKNOWN') && (item.missing.includes('LICENSE_UNKNOWN') || needsStlApproval(item));
      if (item.missing.length === 0 && !needsStlApproval(item)) ready += 1;
      else if (onlyLicenseOrStl) needsLicense += 1;
      else needsInfo += 1;
    }
    return { ready, needsLicense, needsInfo };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (draftTriage === 'ALL') return items;
    return items.filter((item) => {
      if (item.status !== 'DRAFT') return false;
      const onlyLicenseOrStl = item.missing.every((r) => r === 'LICENSE_UNKNOWN') && (item.missing.includes('LICENSE_UNKNOWN') || needsStlApproval(item));
      if (draftTriage === 'READY') return item.missing.length === 0 && !needsStlApproval(item);
      if (draftTriage === 'NEEDS_LICENSE') return onlyLicenseOrStl;
      return item.missing.some((r) => r !== 'LICENSE_UNKNOWN');
    });
  }, [items, draftTriage]);

  // Selection with Shift+click range
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);
  const itemIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const allOnPageSelected = itemIds.length > 0 && itemIds.every((id) => selectedIds.has(id));

  // Inline quick price & name edit
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [inlineNameValue, setInlineNameValue] = useState('');
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  // Modals
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickEditItem, setQuickEditItem] = useState<CatalogUiItem | null>(null);
  const [bulkLicenseOpen, setBulkLicenseOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ mode: 'single'; item: CatalogUiItem } | { mode: 'bulk'; items: CatalogUiItem[] } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // New category inline
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');

  // Status banner
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isPending, startTransition] = useTransition();

  function tabHref(value: CatalogStatusFilter | 'ALL') {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (filters.type) query.set('type', filters.type);
    if (filters.category) query.set('category', filters.category);
    if (filters.source && filters.source !== 'ALL') query.set('source', filters.source);
    if (filters.sort && filters.sort !== 'default') query.set('sort', filters.sort);
    if (value !== 'ALL') query.set('status', value);
    const text = query.toString();
    return text ? `/admin/products?${text}` : '/admin/products';
  }

  function toggleSelect(id: string, shiftKey: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const willSelect = !next.has(id);
      if (shiftKey && lastClickedIdRef.current && lastClickedIdRef.current !== id) {
        const i1 = itemIds.indexOf(lastClickedIdRef.current);
        const i2 = itemIds.indexOf(id);
        if (i1 !== -1 && i2 !== -1) {
          const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
          for (let i = lo; i <= hi; i += 1) {
            if (willSelect) next.add(itemIds[i]);
            else next.delete(itemIds[i]);
          }
          return next;
        }
      }
      if (willSelect) next.add(id);
      else next.delete(id);
      return next;
    });
    lastClickedIdRef.current = id;
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of itemIds) next.delete(id);
      } else {
        for (const id of itemIds) next.add(id);
      }
      return next;
    });
  }

  async function runRowUpdate(
    item: CatalogUiItem,
    patch: Record<string, unknown>,
    successTitle: string,
  ) {
    setBusyRowId(item.id);
    try {
      const res = await quickUpdateCatalogProductAction({ productId: item.id, ...patch });
      if (!res.ok) {
        setNotice({ tone: 'error', title: `${item.name}: ${res.error}` });
        return false;
      }
      setNotice({ tone: 'ok', title: successTitle });
      router.refresh();
      return true;
    } catch {
      setNotice({ tone: 'error', title: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
      return false;
    } finally {
      setBusyRowId(null);
    }
  }

  function handleSaveInlineName(item: CatalogUiItem) {
    const trimmed = inlineNameValue.trim();
    if (!trimmed) {
      setNotice({ tone: 'error', title: 'Tên sản phẩm không được để trống.' });
      return;
    }
    setEditingNameId(null);
    if (trimmed === item.name) return;
    void runRowUpdate(item, { name: trimmed }, `Đã đổi tên → "${trimmed}".`);
  }

  function handleSaveInlinePrice(item: CatalogUiItem) {
    const cleaned = digitsOnly(inlinePriceValue);
    if (!cleaned) {
      setNotice({ tone: 'error', title: 'Nhập giá bán hợp lệ (VND ≥ 0).' });
      return;
    }
    const price = Number(cleaned);
    if (!Number.isSafeInteger(price) || price < 0) {
      setNotice({ tone: 'error', title: 'Giá phải là số nguyên VND ≥ 0.' });
      return;
    }
    setEditingPriceId(null);
    void runRowUpdate(item, { basePrice: price }, `Đã cập nhật giá "${item.name}" → ${formatVnd(price)}`);
  }

  function handleQuickPublishClick(item: CatalogUiItem) {
    // If missing image/price/category/licenseType, open Quick Edit to complete.
    if (item.missing.length > 0) {
      setQuickEditItem(item);
      return;
    }
    // If STL-imported and OWNER clicks "Duyệt & Đăng", confirm licenseReviewed + approve + publish in 1 click.
    if (needsStlApproval(item)) {
      if (!isOwner) {
        setNotice({ tone: 'warn', title: 'Chỉ OWNER mới có quyền duyệt sản phẩm nhập từ kho STL lên web.' });
        return;
      }
      void runRowUpdate(item, { licenseReviewed: true, status: 'ACTIVE' }, `Đã duyệt bản quyền & đăng bán "${item.name}".`);
      return;
    }
    void runRowUpdate(item, { status: 'ACTIVE' }, `Đã đăng bán "${item.name}" lên web.`);
  }

  function reportBulkResult(actionLabel: string, result: BulkCatalogResult) {
    if (result.blocked.length === 0) {
      setNotice({ tone: 'ok', title: `${actionLabel}: thành công ${result.done.length} sản phẩm.` });
    } else {
      setNotice({
        tone: result.done.length > 0 ? 'warn' : 'error',
        title: `${actionLabel}: thành công ${result.done.length}, chưa thực hiện được ${result.blocked.length} sản phẩm.`,
        details: result.blocked.map((b) => ({ label: b.name, reason: b.reason })),
      });
    }
    setSelectedIds(new Set());
    router.refresh();
  }

  function runBulk(actionLabel: string, payload: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const res = await bulkCatalogActionAction(payload);
        if (!res.ok) {
          setNotice({ tone: 'error', title: res.error });
          return;
        }
        reportBulkResult(actionLabel, res.data);
      } catch {
        setNotice({ tone: 'error', title: 'Thao tác hàng loạt thất bại. Vui lòng thử lại.' });
      }
    });
  }

  // Bulk category state
  const [bulkCategoryId, setBulkCategoryId] = useState(realCategories[0]?.id ?? '');
  useEffect(() => {
    if (!bulkCategoryId && realCategories[0]) setBulkCategoryId(realCategories[0].id);
  }, [bulkCategoryId, realCategories]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    if (deleteTarget.mode === 'single') {
      const target = deleteTarget.item;
      startTransition(async () => {
        try {
          const res = await deleteCatalogProductAction(target.id);
          if (!res.ok) {
            setDeleteError(res.error);
            return;
          }
          setDeleteTarget(null);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(target.id);
            return next;
          });
          setNotice({ tone: 'ok', title: `Đã xoá hẳn "${target.name}".` });
          router.refresh();
        } catch {
          setDeleteError('Không thể xoá sản phẩm lúc này.');
        }
      });
    } else {
      const ids = deleteTarget.items.map((i) => i.id);
      startTransition(async () => {
        try {
          const res = await bulkCatalogActionAction({ action: 'DELETE', productIds: ids });
          if (!res.ok) {
            setDeleteError(res.error);
            return;
          }
          setDeleteTarget(null);
          reportBulkResult('Xoá sản phẩm', res.data);
        } catch {
          setDeleteError('Không thể xoá hàng loạt lúc này.');
        }
      });
    }
  }

  async function archiveInsteadOfDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.mode === 'single' ? [deleteTarget.item.id] : deleteTarget.items.map((i) => i.id);
    setDeleteTarget(null);
    setDeleteError(null);
    runBulk('Chuyển sang Lưu trữ', { action: 'SET_STATUS', productIds: ids, status: 'ARCHIVED' });
  }

  async function handleCreateCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!newCatName.trim()) return;
    startTransition(async () => {
      const res = await createCategoryInlineAction({ name: newCatName, slug: newCatSlug });
      if (!res.ok) {
        setNotice({ tone: 'error', title: res.error });
        return;
      }
      setCategories((prev) => [...prev, { id: res.data.id, label: res.data.name, slug: res.data.slug }]);
      setNewCatName('');
      setNewCatSlug('');
      setNotice({ tone: 'ok', title: `Đã thêm danh mục "${res.data.name}".` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PublishBlockedNotice value={publishBlocked} />
      {missingNotice.length ? (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Chưa đăng bán được: {missingNotice.join(', ')}. Bấm <strong>Sửa nhanh</strong> để bổ sung và duyệt ngay.
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : notice.tone === 'warn'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium">{notice.title}</p>
            {notice.details?.length ? (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
                {notice.details.map((d) => (
                  <li key={`${d.label}-${d.reason}`}>
                    <strong>{d.label}:</strong> {d.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo"
            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sản phẩm</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý nhanh danh mục, giá bán, bản quyền STL và trạng thái hiển thị trên web.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/product-inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Boxes className="mr-1.5 size-4" /> Kho &amp; giá
          </Link>
          <Link href="/admin/stl-import" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Sparkles className="mr-1.5 size-4" /> Kho nhập STL
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={() => setQuickCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Thêm nhanh
          </Button>
          <Link href="/admin/products/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="mr-1.5 size-4" /> Đăng sản phẩm mới
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <nav aria-label="Trạng thái" className="flex gap-6 overflow-x-auto border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = (filters.status ?? 'ALL') === tab.value;
          const count = tab.value === 'ALL' ? total : statusCounts[tab.value];
          return (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
            </Link>
          );
        })}
      </nav>

      {/* Filters + Sort */}
      <form method="get" className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Tìm theo tên, slug, màu hoặc SKU…"
            className="pl-9"
            aria-label="Tìm sản phẩm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="type"
            defaultValue={filters.type ?? ''}
            aria-label="Hình thức bán"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Mọi hình thức bán</option>
            <option value="MADE_TO_ORDER">In theo yêu cầu</option>
            <option value="READY_STOCK">Có sẵn, giao ngay</option>
          </select>
          <select
            name="category"
            defaultValue={filters.category ?? ''}
            aria-label="Danh mục"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm max-w-[180px]"
          >
            <option value="">Mọi danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={filters.source ?? 'ALL'}
            aria-label="Nguồn tạo"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">Mọi nguồn</option>
            <option value="STL">Nhập từ kho STL</option>
            <option value="MANUAL">Tạo thủ công</option>
          </select>
          <select
            name="sort"
            defaultValue={filters.sort ?? 'default'}
            aria-label="Sắp xếp"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="default">Nháp trước · mới nhất</option>
            <option value="updated_desc">Mới cập nhật</option>
            <option value="name_asc">Tên A → Z</option>
            <option value="price_asc">Giá thấp → cao</option>
            <option value="price_desc">Giá cao → thấp</option>
          </select>
          <Button type="submit" variant="outline" size="sm" className="h-9">Lọc</Button>
          {filters.q || filters.type || filters.category || (filters.source && filters.source !== 'ALL') || (filters.sort && filters.sort !== 'default') ? (
            <Link
              href={filters.status ? `/admin/products?status=${filters.status}` : '/admin/products'}
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-9' })}
            >
              Xoá lọc
            </Link>
          ) : null}
        </div>
      </form>

      {/* Triage pills on Drafts (inspired by D:\3D_Catalog) */}
      {items.some((i) => i.status === 'DRAFT') ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc nhanh bản nháp">
          {([
            ['ALL', 'Tất cả trên trang', items.length],
            ['READY', 'Sẵn sàng đăng', triageCounts.ready],
            ['NEEDS_LICENSE', 'Chờ bản quyền / duyệt STL', triageCounts.needsLicense],
            ['NEEDS_INFO', 'Thiếu ảnh / giá / danh mục', triageCounts.needsInfo],
          ] as const).map(([key, label, cnt]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDraftTriage(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                draftTriage === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{label}</span>
              <span className="tabular-nums opacity-80">{cnt}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Toolbar (Select page + View switcher — inspired by D:\3D_Catalog) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          {visibleItems.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={toggleSelectPage} className="h-8">
              <Check className="mr-1.5 size-3.5" />
              {allOnPageSelected ? 'Bỏ chọn trang này' : `Chọn trang này (${visibleItems.length})`}
            </Button>
          ) : null}
          <span>
            Hiển thị <strong className="text-foreground tabular-nums">{visibleItems.length}</strong> mục
            {selectedIds.size > 0 ? <> · Đã chọn <strong className="text-primary tabular-nums">{selectedIds.size}</strong></> : ' · Mẹo: giữ Shift khi tick để chọn dải'}
          </span>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Kiểu hiển thị">
          <button
            type="button"
            onClick={() => switchView('grid')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="size-3.5" /> Lưới thẻ
          </button>
          <button
            type="button"
            onClick={() => switchView('list')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="size-3.5" /> Danh sách
          </button>
        </div>
      </div>

      {/* Items */}
      {visibleItems.length ? (
        viewMode === 'list' ? (
          <Card className="gap-0 overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {visibleItems.map((item) => {
                const selected = selectedIds.has(item.id);
                const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.DRAFT;
                const stlNeedsApproval = needsStlApproval(item);
                const isBusy = busyRowId === item.id;
                const readyNow = item.status === 'DRAFT' && item.missing.length === 0 && (!stlNeedsApproval || isOwner);

                return (
                  <li
                    key={item.id}
                    className={`flex flex-col gap-3 px-4 py-3 transition-colors lg:flex-row lg:items-center ${
                      selected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Checkbox + Thumb + Info */}
                    <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                      <label className="mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted sm:mt-0">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const shift = (e.nativeEvent as MouseEvent).shiftKey;
                            toggleSelect(item.id, Boolean(shift));
                          }}
                          aria-label={`Chọn ${item.name}`}
                          className="size-4 accent-primary"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setQuickEditItem(item)}
                        className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted transition-opacity hover:opacity-90"
                        title="Bấm để sửa nhanh"
                      >
                        {item.coverUrl ? (
                          <img src={item.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <ImageOff className="size-5 text-muted-foreground/60" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {editingNameId === item.id ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <Input
                                autoFocus
                                value={inlineNameValue}
                                maxLength={200}
                                onChange={(e) => setInlineNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleSaveInlineName(item); }
                                  if (e.key === 'Escape') setEditingNameId(null);
                                }}
                                className="h-7 min-w-[180px] flex-1 text-sm font-medium"
                                aria-label="Sửa tên sản phẩm nhanh"
                              />
                              <Button type="button" size="icon-xs" onClick={() => handleSaveInlineName(item)} title="Lưu tên">
                                <Check className="size-3" />
                              </Button>
                              <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEditingNameId(null)} title="Huỷ">
                                <X className="size-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNameId(item.id);
                                setInlineNameValue(item.name);
                              }}
                              className="group inline-flex max-w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left font-medium hover:bg-muted"
                              title="Bấm để sửa tên nhanh"
                            >
                              <span className="truncate">{item.name}</span>
                              <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          )}
                          <Badge variant="outline" className={`text-[11px] ${badge.className}`}>{badge.label}</Badge>
                          {item.imported ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">STL</Badge>
                          ) : null}
                          {item.isFeatured ? (
                            <Badge variant="secondary" className="gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <Star className="size-2.5 fill-current" /> Nổi bật
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {item.productType === 'READY_STOCK' ? (
                            <span className="inline-flex items-center gap-1"><Package className="size-3" /> Có sẵn</span>
                          ) : (
                            <span className="inline-flex items-center gap-1"><Printer className="size-3" /> In theo yêu cầu</span>
                          )}
                          <span>·</span>
                          <span>{item.variantCount} biến thể</span>
                          <span>·</span>
                          <select
                            aria-label={`Đổi danh mục cho ${item.name}`}
                            value={item.categoryId ?? ''}
                            disabled={isBusy}
                            onChange={(e) => {
                              const nextCatId = e.target.value;
                              if (!nextCatId) return;
                              void runRowUpdate(item, { categoryId: nextCatId }, `Đã đổi danh mục "${item.name}".`);
                            }}
                            className="h-6 max-w-[170px] rounded border border-border bg-background px-1.5 text-xs text-foreground"
                          >
                            <option value="">Chưa có danh mục</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                          </select>
                          {item.status === 'DRAFT' ? (
                            <select
                              aria-label={`Chọn bản quyền cho ${item.name}`}
                              value={item.licenseType || 'UNKNOWN'}
                              disabled={isBusy}
                              onChange={(e) => void runRowUpdate(item, { licenseType: e.target.value }, `Đã cập nhật bản quyền "${item.name}".`)}
                              className={`h-6 max-w-[180px] rounded border px-1.5 text-xs ${
                                item.licenseType === 'UNKNOWN'
                                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : 'border-border bg-background text-foreground'
                              }`}
                            >
                              {LICENSE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : null}
                        </div>

                        {item.status === 'DRAFT' ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <ReadinessPills item={item} onFix={() => setQuickEditItem(item)} />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Inline quick price + Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                      <div className="min-w-[120px] text-sm font-medium tabular-nums lg:text-right">
                        {editingPriceId === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              autoFocus
                              inputMode="numeric"
                              value={inlinePriceValue}
                              onChange={(e) => setInlinePriceValue(digitsOnly(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleSaveInlinePrice(item); }
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                              className="h-7 w-28 text-right text-xs tabular-nums"
                              aria-label="Giá bán nhanh"
                            />
                            <Button type="button" size="icon-xs" onClick={() => handleSaveInlinePrice(item)} title="Lưu giá">
                              <Check className="size-3" />
                            </Button>
                            <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEditingPriceId(null)} title="Huỷ">
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceId(item.id);
                              setInlinePriceValue(item.basePrice != null ? String(item.basePrice) : '');
                            }}
                            className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                            title="Bấm để sửa giá nhanh"
                          >
                            <span>{priceLabel(item)}</span>
                            <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {item.status === 'DRAFT' ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleQuickPublishClick(item)}
                            className={readyNow ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                            title={readyNow ? 'Duyệt & đăng bán ngay lên web' : 'Bổ sung nhanh thông tin còn thiếu'}
                          >
                            {isBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ShieldCheck className="mr-1 size-3.5" />}
                            {readyNow ? 'Duyệt & Đăng' : 'Sửa & Duyệt'}
                          </Button>
                        ) : null}

                        {item.status === 'ACTIVE' ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant={item.isFeatured ? 'secondary' : 'ghost'}
                              disabled={isBusy}
                              onClick={() => void runRowUpdate(item, { isFeatured: !item.isFeatured }, item.isFeatured ? `Đã bỏ nổi bật "${item.name}".` : `Đã đặt "${item.name}" nổi bật.`)}
                              title={item.isFeatured ? 'Bỏ nổi bật' : 'Đặt nổi bật trang chủ'}
                              aria-label="Nổi bật"
                            >
                              <Star className={`size-3.5 ${item.isFeatured ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => void runRowUpdate(item, { status: 'DRAFT' }, `Đã đưa "${item.name}" về Nháp.`)}
                              title="Chuyển về Nháp (ẩn khỏi web để chỉnh sửa)"
                            >
                              <RotateCcw className="mr-1 size-3.5" /> Về nháp
                            </Button>
                            <Link
                              href={`/vi/products/${item.slug}`}
                              target="_blank"
                              className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
                              title="Xem trên trang bán hàng"
                              aria-label="Xem trên web"
                            >
                              <ExternalLink className="size-3.5 text-muted-foreground" />
                            </Link>
                          </>
                        ) : null}

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => setQuickEditItem(item)}
                        >
                          <Pencil className="mr-1 size-3.5" /> Sửa nhanh
                        </Button>

                        <Link
                          href={`/admin/products/${item.id}`}
                          className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                          title="Mở trang chi tiết (ảnh, biến thể, tính giá)"
                        >
                          Chi tiết
                        </Link>

                        {item.status === 'ARCHIVED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => void runRowUpdate(item, { status: 'DRAFT' }, `Đã khôi phục "${item.name}" về Nháp.`)}
                            title="Khôi phục về Nháp"
                          >
                            <ArchiveRestore className="mr-1 size-3.5" /> Khôi phục
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => void runRowUpdate(item, { status: 'ARCHIVED' }, `Đã lưu trữ "${item.name}".`)}
                            title="Lưu trữ (ẩn khỏi web, giữ lịch sử)"
                            aria-label="Lưu trữ"
                          >
                            <Archive className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}

                        {isOwner ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => { setDeleteError(null); setDeleteTarget({ mode: 'single', item }); }}
                            title="Xoá hẳn sản phẩm"
                            aria-label={`Xoá ${item.name}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          /* Card Grid view (inspired by D:\3D_Catalog\catalog.html) */
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item) => {
              const selected = selectedIds.has(item.id);
              const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.DRAFT;
              const stlNeedsApproval = needsStlApproval(item);
              const isBusy = busyRowId === item.id;
              const readyNow = item.status === 'DRAFT' && item.missing.length === 0 && (!stlNeedsApproval || isOwner);
              const cardBorderClass = selected
                ? 'border-primary ring-2 ring-primary/30'
                : item.status === 'DRAFT'
                  ? readyNow
                    ? 'border-emerald-500/45'
                    : 'border-amber-500/35'
                  : 'border-border';

              return (
                <article
                  key={item.id}
                  className={`group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors ${cardBorderClass}`}
                >
                  {/* Thumbnail + Overlay controls */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <button
                      type="button"
                      onClick={() => setQuickEditItem(item)}
                      className="block size-full text-left"
                      title="Bấm để sửa nhanh"
                    >
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={item.name}
                          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                          <ImageOff className="size-6 opacity-60" />
                          <span>Chưa có ảnh</span>
                        </div>
                      )}
                    </button>

                    <div className="absolute left-2 top-2 flex items-center gap-1.5">
                      <label className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-background/90">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const shift = (e.nativeEvent as MouseEvent).shiftKey;
                            toggleSelect(item.id, Boolean(shift));
                          }}
                          aria-label={`Chọn ${item.name}`}
                          className="size-4 accent-primary"
                        />
                      </label>
                      <Badge variant="outline" className={`bg-background/90 text-[11px] ${badge.className}`}>{badge.label}</Badge>
                      {item.imported ? (
                        <Badge variant="outline" className="bg-background/90 text-[10px] text-muted-foreground">STL</Badge>
                      ) : null}
                    </div>

                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runRowUpdate(item, { isFeatured: !item.isFeatured }, item.isFeatured ? `Đã bỏ nổi bật "${item.name}".` : `Đã đặt "${item.name}" nổi bật.`)}
                        title={item.isFeatured ? 'Bỏ nổi bật' : 'Đặt nổi bật'}
                        className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/90 transition-colors hover:bg-background"
                      >
                        <Star className={`size-4 ${item.isFeatured ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => { setDeleteError(null); setDeleteTarget({ mode: 'single', item }); }}
                          title="Xoá hẳn"
                          className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/90 text-destructive transition-colors hover:bg-destructive/15"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    {editingNameId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={inlineNameValue}
                          maxLength={200}
                          onChange={(e) => setInlineNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleSaveInlineName(item); }
                            if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          className="h-7 flex-1 text-xs font-semibold"
                          aria-label="Sửa tên sản phẩm nhanh"
                        />
                        <Button type="button" size="icon-xs" onClick={() => handleSaveInlineName(item)} title="Lưu tên">
                          <Check className="size-3" />
                        </Button>
                        <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEditingNameId(null)} title="Huỷ">
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNameId(item.id);
                          setInlineNameValue(item.name);
                        }}
                        className="group flex items-start justify-between gap-1 rounded px-1 py-0.5 text-left text-sm font-semibold leading-snug hover:bg-muted"
                        title="Bấm để sửa tên nhanh"
                      >
                        <span className="line-clamp-2">{item.name}</span>
                        <Pencil className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-2 text-xs">
                      {editingPriceId === item.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            inputMode="numeric"
                            value={inlinePriceValue}
                            onChange={(e) => setInlinePriceValue(digitsOnly(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleSaveInlinePrice(item); }
                              if (e.key === 'Escape') setEditingPriceId(null);
                            }}
                            className="h-7 w-24 text-xs tabular-nums"
                          />
                          <Button type="button" size="icon-xs" onClick={() => handleSaveInlinePrice(item)}><Check className="size-3" /></Button>
                          <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEditingPriceId(null)}><X className="size-3" /></Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceId(item.id);
                            setInlinePriceValue(item.basePrice != null ? String(item.basePrice) : '');
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 tabular-nums hover:bg-emerald-500/20 dark:text-emerald-400"
                          title="Bấm để sửa giá nhanh"
                        >
                          {priceLabel(item)}
                          <Pencil className="size-2.5 opacity-70" />
                        </button>
                      )}
                      <span className="text-muted-foreground">{item.productType === 'READY_STOCK' ? 'Có sẵn' : 'In theo YC'} · {item.variantCount} BT</span>
                    </div>

                    {item.status === 'DRAFT' ? (
                      <div className="flex flex-wrap gap-1">
                        <ReadinessPills item={item} onFix={() => setQuickEditItem(item)} />
                      </div>
                    ) : null}

                    {/* Inline category */}
                    <select
                      aria-label={`Đổi danh mục cho ${item.name}`}
                      value={item.categoryId ?? ''}
                      disabled={isBusy}
                      onChange={(e) => {
                        const nextCatId = e.target.value;
                        if (!nextCatId) return;
                        void runRowUpdate(item, { categoryId: nextCatId }, `Đã đổi danh mục "${item.name}".`);
                      }}
                      className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                    >
                      <option value="">— Chưa có danh mục —</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>

                    {/* Inline quick license on DRAFT when missing/unreviewed */}
                    {item.status === 'DRAFT' && (item.licenseType === 'UNKNOWN' || stlNeedsApproval) ? (
                      <select
                        aria-label={`Chọn bản quyền cho ${item.name}`}
                        value={item.licenseType || 'UNKNOWN'}
                        disabled={isBusy}
                        onChange={(e) => void runRowUpdate(item, { licenseType: e.target.value }, `Đã cập nhật bản quyền "${item.name}".`)}
                        className={`h-8 w-full rounded-lg border px-2.5 text-xs ${
                          item.licenseType === 'UNKNOWN'
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                            : 'border-input bg-background text-foreground'
                        }`}
                      >
                        {LICENSE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : null}

                    {/* Card footer actions */}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {item.status === 'DRAFT' ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleQuickPublishClick(item)}
                          className={`flex-1 ${readyNow ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
                        >
                          {isBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ShieldCheck className="mr-1 size-3.5" />}
                          {readyNow ? 'Duyệt & Đăng' : 'Sửa & Duyệt'}
                        </Button>
                      ) : item.status === 'ACTIVE' ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void runRowUpdate(item, { status: 'DRAFT' }, `Đã đưa "${item.name}" về Nháp.`)}
                            className="flex-1"
                            title="Đưa sản phẩm đang bán về Nháp"
                          >
                            <RotateCcw className="mr-1 size-3.5" /> Về nháp
                          </Button>
                          <Link
                            href={`/vi/products/${item.slug}`}
                            target="_blank"
                            className={buttonVariants({ size: 'icon-sm', variant: 'outline' })}
                            title="Xem trên web"
                            aria-label="Xem trên web"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void runRowUpdate(item, { status: 'DRAFT' }, `Đã khôi phục "${item.name}" về Nháp.`)}
                          className="flex-1"
                        >
                          <ArchiveRestore className="mr-1 size-3.5" /> Khôi phục
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => setQuickEditItem(item)}>
                        Sửa
                      </Button>
                      {item.status !== 'ARCHIVED' ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => void runRowUpdate(item, { status: 'ARCHIVED' }, `Đã lưu trữ "${item.name}".`)}
                          title="Lưu trữ"
                          aria-label="Lưu trữ"
                        >
                          <Archive className="size-3.5 text-muted-foreground" />
                        </Button>
                      ) : null}
                      <Link href={`/admin/products/${item.id}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })} title="Trang chi tiết">
                        Chi tiết
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Package className="size-8 text-muted-foreground/60" />
          <p className="font-medium">{total ? 'Không có sản phẩm nào khớp' : 'Chưa có sản phẩm nào'}</p>
          <p className="text-sm text-muted-foreground">
            {total ? 'Thử đổi tab hoặc bỏ bớt bộ lọc.' : 'Bắt đầu bằng nút “Thêm nhanh” hoặc “Đăng sản phẩm mới”.'}
          </p>
        </div>
      )}

      <AdminPagination
        basePath="/admin/products"
        page={page}
        hasNext={hasNext}
        filters={{
          q: filters.q,
          type: filters.type,
          category: filters.category,
          status: filters.status,
          source: filters.source !== 'ALL' ? filters.source : undefined,
          sort: filters.sort !== 'default' ? filters.sort : undefined,
        }}
      />

      {/* Categories collapsible */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Quản lý danh mục ({categories.length})
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category.id} variant="secondary">{category.label}</Badge>
            ))}
          </div>
          <form onSubmit={handleCreateCategory} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Tên danh mục mới</Label>
              <Input id="cat-name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">Đường dẫn (để trống = tự tạo)</Label>
              <Input id="cat-slug" value={newCatSlug} onChange={(e) => setNewCatSlug(e.target.value)} placeholder="tự tạo" />
            </div>
            <Button type="submit" variant="outline" disabled={isPending}>Thêm danh mục</Button>
          </form>
        </div>
      </details>

      {/* Floating Bulk Action Bar (inspired by D:\3D_Catalog) */}
      {selectedIds.size > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto w-[min(1080px,calc(100%-2rem))] rounded-xl border border-border bg-popover p-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold tabular-nums">Đã chọn {selectedIds.size}</span>

            <div className="flex items-center gap-1">
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                aria-label="Chọn danh mục hàng loạt"
                className="h-8 max-w-[170px] rounded-lg border border-input bg-background px-2 text-xs"
              >
                {realCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || !bulkCategoryId}
                onClick={() => runBulk('Đổi danh mục', { action: 'SET_CATEGORY', productIds: [...selectedIds], categoryId: bulkCategoryId })}
              >
                Đổi danh mục
              </Button>
            </div>

            {selectedIds.size >= 2 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => setMergeOpen(true)}
              >
                <Layers className="mr-1 size-3.5" /> Gộp thành 1 SP
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => setBulkLicenseOpen(true)}
            >
              <ShieldCheck className="mr-1 size-3.5" /> Bản quyền &amp; Duyệt
            </Button>

            {filters.status !== 'ACTIVE' ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulk('Đăng bán hàng loạt', {
                  action: 'PUBLISH',
                  productIds: [...selectedIds],
                  confirmLicenseReviewed: isOwner,
                })}
              >
                Đăng bán ngay
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runBulk('Đưa về Nháp', { action: 'SET_STATUS', productIds: [...selectedIds], status: 'DRAFT' })}
            >
              Về nháp
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runBulk('Lưu trữ', { action: 'SET_STATUS', productIds: [...selectedIds], status: 'ARCHIVED' })}
            >
              Lưu trữ
            </Button>

            {isOwner ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => { setDeleteError(null); setDeleteTarget({ mode: 'bulk', items: selectedItems }); }}
              >
                <Trash2 className="mr-1 size-3.5" /> Xoá hẳn
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      ) : null}

      {/* Quick Create Dialog */}
      <QuickCreateProductDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        categories={realCategories}
        onCreated={(msg) => {
          setNotice({ tone: 'ok', title: msg });
          router.refresh();
        }}
      />

      {/* Quick Edit Dialog */}
      <QuickEditProductDialog
        item={quickEditItem}
        categories={categories}
        isOwner={isOwner}
        onClose={() => setQuickEditItem(null)}
        onSaved={(msg) => {
          setQuickEditItem(null);
          setNotice({ tone: 'ok', title: msg });
          router.refresh();
        }}
      />

      {/* Merge Selected Products into 1 Multi-Variant Product */}
      <MergeProductsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        items={selectedItems}
        categories={realCategories}
        isOwner={isOwner}
        onMerged={(msg) => {
          setMergeOpen(false);
          setSelectedIds(new Set());
          setNotice({ tone: 'ok', title: msg });
          router.refresh();
        }}
      />

      {/* Bulk License & Approve Dialog */}
      <BulkLicenseDialog
        open={bulkLicenseOpen}
        onOpenChange={setBulkLicenseOpen}
        count={selectedIds.size}
        isOwner={isOwner}
        pending={isPending}
        onSubmit={(payload) => {
          setBulkLicenseOpen(false);
          runBulk(
            payload.publish ? 'Cập nhật bản quyền & Đăng bán' : 'Cập nhật bản quyền',
            { action: 'APPLY_LICENSE', productIds: [...selectedIds], ...payload },
          );
        }}
      />

      {/* Delete Confirm Dialog (per overlay.md) */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {deleteTarget?.mode === 'bulk' ? `Xoá ${deleteTarget.items.length} sản phẩm?` : 'Xoá sản phẩm?'}
            </DialogTitle>
            <div className="col-span-2 mt-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:mt-0.5">
              {deleteTarget?.mode === 'single' ? (
                <DialogDescription className="text-sm/6 text-muted-foreground">
                  <span className="font-medium text-foreground">{deleteTarget.item.name}</span> cùng các biến thể và ảnh liên quan sẽ bị xoá vĩnh viễn, không khôi phục được.
                </DialogDescription>
              ) : deleteTarget?.mode === 'bulk' ? (
                <DialogDescription className="text-sm/6 text-muted-foreground">
                  <span className="font-medium text-foreground">{deleteTarget.items.length} sản phẩm đã chọn</span> sẽ bị xoá vĩnh viễn nếu chưa phát sinh đơn hàng hay lịch sử kho.
                </DialogDescription>
              ) : null}
              {deleteError ? (
                <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <p>{deleteError}</p>
                  <Button type="button" size="xs" variant="outline" className="mt-2" onClick={archiveInsteadOfDelete}>
                    Chuyển sang Lưu trữ thay thế
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Huỷ</Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={confirmDelete}>
              {isPending ? 'Đang xoá…' : deleteTarget?.mode === 'bulk' ? 'Xoá các mục đã chọn' : 'Xoá sản phẩm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadinessPills({ item, onFix }: { item: CatalogUiItem; onFix: () => void }) {
  const hasImage = !item.missing.includes('NO_IMAGE');
  const hasPrice = !item.missing.includes('NO_PRICE');
  const hasCat = !item.missing.includes('UNCATEGORIZED');
  const hasLicense = !item.missing.includes('LICENSE_UNKNOWN') && !needsStlApproval(item);

  const pills: { label: string; ok: boolean }[] = [
    { label: 'Ảnh', ok: hasImage },
    { label: 'Giá', ok: hasPrice },
    { label: 'Danh mục', ok: hasCat },
    { label: item.imported && !item.importLicenseReviewed ? 'Duyệt STL' : 'Bản quyền', ok: hasLicense },
  ];

  return (
    <>
      {pills.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={onFix}
          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            p.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300'
          }`}
          title={p.ok ? `${p.label}: đạt` : `Bấm để bổ sung ${p.label.toLowerCase()}`}
        >
          {p.ok ? '✓' : '!'} {p.label}
        </button>
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-dialogs                                                                */
/* -------------------------------------------------------------------------- */

function QuickCreateProductDialog({
  open,
  onOpenChange,
  categories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CatalogCategoryOption[];
  onCreated: (message: string) => void;
}) {
  const requestIdRef = useRef<string | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [productType, setProductType] = useState<'MADE_TO_ORDER' | 'READY_STOCK'>('MADE_TO_ORDER');
  const [basePriceText, setBasePriceText] = useState('');
  const [licenseType, setLicenseType] = useState('OWN_DESIGN');
  const [licenseSourceUrl, setLicenseSourceUrl] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      requestIdRef.current = null;
      setError(null);
      if (!categoryId && categories[0]) setCategoryId(categories[0].id);
    }
  }, [open, categoryId, categories]);

  function reset() {
    requestIdRef.current = null;
    setImages([]);
    setCoverKey(null);
    setName('');
    setBasePriceText('');
    setLicenseType('OWN_DESIGN');
    setLicenseSourceUrl('');
    setShortDescription('');
    setIsFeatured(false);
    setError(null);
  }

  async function handleSubmit(publish: boolean) {
    setError(null);
    const price = Number(digitsOnly(basePriceText));
    if (!name.trim()) { setError('Nhập tên sản phẩm.'); return; }
    if (!categoryId) { setError('Chọn danh mục.'); return; }
    if (!Number.isSafeInteger(price) || price <= 0) { setError('Nhập giá bán lớn hơn 0.'); return; }
    if (['CC_BY', 'CC0', 'COMMERCIAL_LICENSE'].includes(licenseType) && !licenseSourceUrl.trim()) {
      setError('Mẫu có license cần link nguồn model.');
      return;
    }
    if (images.some((i) => !i.blob && !i.error)) { setError('Đợi ảnh nén xong rồi lưu.'); return; }

    setBusy(true);
    try {
      const created = await createProductOnboardingAction({
        requestId: (requestIdRef.current ??= globalThis.crypto.randomUUID()),
        name: name.trim(),
        categoryId,
        shortDescription: shortDescription.trim() || null,
        description: null,
        productType,
        basePrice: price,
        pricingBreakdown: null,
        pricingConfigId: null,
        licenseType,
        licenseSourceUrl: licenseSourceUrl.trim() || null,
        licenseProofUrl: null,
        seoTitle: null,
        seoDescription: null,
        isFeatured,
        warehouseId: null,
        variants: [{ name: 'Mặc định', openingStock: 0 }],
      });
      if (!created.ok) { setError(created.message); return; }

      const readyImages = images.filter((i) => i.blob && !i.error);
      if (readyImages.length) {
        try {
          await uploadProductImages(
            created.data.productId,
            readyImages.map((i) => ({ key: i.key, blob: i.blob as Blob })),
            coverKey,
            {},
          );
        } catch (cause) {
          setError(`${cause instanceof ProductImageUploadError ? cause.message : 'Tải ảnh thất bại.'} Sản phẩm đã lưu nháp.`);
          return;
        }
      }

      if (publish) {
        const pub = await publishProductAction(created.data.productId);
        if (!pub.ok) { setError(pub.message); return; }
        if (!pub.data.published) {
          reset();
          onOpenChange(false);
          onCreated(`Đã tạo nháp "${name.trim()}" (chưa đăng bán được vì: ${pub.data.reasons.join(', ')}).`);
          return;
        }
        reset();
        onOpenChange(false);
        onCreated(`Đã tạo & đăng bán "${name.trim()}".`);
        return;
      }

      reset();
      onOpenChange(false);
      onCreated(`Đã tạo nháp "${name.trim()}".`);
    } catch {
      setError('Mất kết nối tới máy chủ. Thử lại nhé.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm sản phẩm nhanh</DialogTitle>
          <DialogDescription>
            Tạo nhanh 1 sản phẩm ngay tại danh sách. Cần nhiều biến thể màu hoặc bảng tính giá → dùng &quot;Đăng sản phẩm mới&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <ProductImagePicker
            images={images}
            onImagesChange={setImages}
            coverKey={coverKey}
            onCoverChange={setCoverKey}
            disabled={busy}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-name">Tên sản phẩm *</Label>
              <Input id="qc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Móc khoá mèo Shiba" disabled={busy} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-cat">Danh mục *</Label>
              <select
                id="qc-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">— Chọn danh mục —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-type">Hình thức bán</Label>
              <select
                id="qc-type"
                value={productType}
                onChange={(e) => setProductType(e.target.value as 'MADE_TO_ORDER' | 'READY_STOCK')}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="MADE_TO_ORDER">In theo yêu cầu</option>
                <option value="READY_STOCK">Có sẵn, giao ngay</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-price">Giá bán (VND) *</Label>
              <Input
                id="qc-price"
                inputMode="numeric"
                value={basePriceText}
                onChange={(e) => setBasePriceText(digitsOnly(e.target.value))}
                placeholder="VD: 35000"
                disabled={busy}
                className="tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-lic">Nguồn mẫu / bản quyền</Label>
              <select
                id="qc-lic"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {LICENSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-url">Link nguồn model {['CC_BY', 'CC0', 'COMMERCIAL_LICENSE'].includes(licenseType) ? '*' : ''}</Label>
              <Input
                id="qc-url"
                type="url"
                value={licenseSourceUrl}
                onChange={(e) => setLicenseSourceUrl(e.target.value)}
                placeholder="https://makerworld.com/..."
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qc-short">Mô tả ngắn</Label>
            <Textarea id="qc-short" rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} disabled={busy} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-4" disabled={busy} />
            Nổi bật trên trang chủ
          </label>

          {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void handleSubmit(false)}>Lưu nháp</Button>
          <Button type="button" disabled={busy || licenseType === 'UNKNOWN'} onClick={() => void handleSubmit(true)}>
            {busy ? 'Đang lưu…' : 'Lưu & Đăng bán'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickEditProductDialog({
  item,
  categories,
  isOwner,
  onClose,
  onSaved,
}: {
  item: CatalogUiItem | null;
  categories: CatalogCategoryOption[];
  isOwner: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState<'MADE_TO_ORDER' | 'READY_STOCK'>('MADE_TO_ORDER');
  const [basePriceText, setBasePriceText] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');
  const [shortDescription, setShortDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [licenseType, setLicenseType] = useState('OWN_DESIGN');
  const [licenseSourceUrl, setLicenseSourceUrl] = useState('');
  const [licenseProofUrl, setLicenseProofUrl] = useState('');
  const [licenseReviewed, setLicenseReviewed] = useState(false);
  const [printLocalPath, setPrintLocalPath] = useState('');
  const [printDriveUrl, setPrintDriveUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategoryId(item.categoryId ?? '');
    setProductType(item.productType === 'READY_STOCK' ? 'READY_STOCK' : 'MADE_TO_ORDER');
    setBasePriceText(item.basePrice != null ? String(item.basePrice) : '');
    setStatus((item.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED') ?? 'DRAFT');
    setShortDescription(item.shortDescription ?? '');
    setIsFeatured(item.isFeatured);
    setLicenseType(item.licenseType || 'UNKNOWN');
    setLicenseSourceUrl(item.licenseSourceUrl ?? '');
    setLicenseProofUrl(item.licenseProofUrl ?? '');
    setLicenseReviewed(Boolean(item.importLicenseReviewed));
    setPrintLocalPath(item.printLocalPath ?? '');
    setPrintDriveUrl(item.printDriveUrl ?? '');
    setError(null);
  }, [item]);

  async function save(forceStatus?: 'ACTIVE') {
    if (!item) return;
    setError(null);
    if (!name.trim()) { setError('Tên sản phẩm không được để trống.'); return; }
    const price = basePriceText.trim() === '' ? null : Number(digitsOnly(basePriceText));
    if (price !== null && (!Number.isSafeInteger(price) || price < 0)) {
      setError('Giá bán phải là số nguyên VND ≥ 0.');
      return;
    }

    const targetStatus = forceStatus ?? status;
    setBusy(true);
    try {
      const res = await quickUpdateCatalogProductAction({
        productId: item.id,
        name: name.trim(),
        categoryId: categoryId || null,
        productType,
        basePrice: price,
        shortDescription: shortDescription.trim() || null,
        isFeatured,
        status: targetStatus,
        licenseType,
        licenseSourceUrl: licenseSourceUrl.trim() || null,
        licenseProofUrl: licenseProofUrl.trim() || null,
        printLocalPath: printLocalPath.trim() || null,
        printDriveUrl: printDriveUrl.trim() || null,
        ...(item.imported ? { licenseReviewed } : {}),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved(
        targetStatus === 'ACTIVE' && item.status !== 'ACTIVE'
          ? `Đã lưu & đăng bán "${res.data.name}".`
          : `Đã cập nhật "${res.data.name}".`,
      );
    } catch {
      setError('Không kết nối được máy chủ. Thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {item ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 pr-6">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate">Sửa nhanh: {item.name}</DialogTitle>
                  <DialogDescription className="truncate text-xs">
                    /{item.slug} · {item.variantCount} biến thể
                    {item.imported ? ' · Nhập từ kho STL' : ''}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {item.importWarnings.length ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {item.importWarnings.map((w) => WARNING_LABELS[w] ?? w).join(' · ')}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="qe-name">Tên sản phẩm</Label>
                  <Input id="qe-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-cat">Danh mục</Label>
                  <select
                    id="qe-cat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={busy}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    <option value="">— Chưa chọn danh mục —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-price">Giá bán (VND)</Label>
                  <Input
                    id="qe-price"
                    inputMode="numeric"
                    value={basePriceText}
                    onChange={(e) => setBasePriceText(digitsOnly(e.target.value))}
                    disabled={busy}
                    className="tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-type">Hình thức bán</Label>
                  <select
                    id="qe-type"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'MADE_TO_ORDER' | 'READY_STOCK')}
                    disabled={busy}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    <option value="MADE_TO_ORDER">In theo yêu cầu</option>
                    <option value="READY_STOCK">Có sẵn, giao ngay</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-status">Trạng thái</Label>
                  <select
                    id="qe-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')}
                    disabled={busy}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    <option value="DRAFT">Nháp (DRAFT)</option>
                    <option value="ACTIVE">Đang bán (ACTIVE)</option>
                    <option value="ARCHIVED">Đã lưu trữ (ARCHIVED)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qe-short">Mô tả ngắn</Label>
                <Textarea id="qe-short" rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} disabled={busy} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-4" disabled={busy} />
                Nổi bật trên trang chủ
              </label>

              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-center justify-between text-xs font-semibold">
                  <span>Bản quyền &amp; nguồn model</span>
                  {item.importSourceRelPath ? (
                    <span className="max-w-[260px] truncate font-normal text-muted-foreground" title={item.importSourceRelPath}>
                      📁 {item.importSourceRelPath}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-lic">Loại bản quyền</Label>
                  <select
                    id="qe-lic"
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value)}
                    disabled={busy}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {LICENSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-url">Link nguồn model</Label>
                  <Input
                    id="qe-url"
                    type="url"
                    value={licenseSourceUrl}
                    onChange={(e) => setLicenseSourceUrl(e.target.value)}
                    placeholder="https://makerworld.com/..."
                    disabled={busy}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="qe-proof">Link bằng chứng license (tuỳ chọn)</Label>
                  <Input
                    id="qe-proof"
                    type="url"
                    value={licenseProofUrl}
                    onChange={(e) => setLicenseProofUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={busy}
                  />
                </div>
                {item.imported ? (
                  <label className="sm:col-span-2 flex items-center gap-2 border-t border-border pt-2.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={licenseReviewed}
                      onChange={(e) => setLicenseReviewed(e.target.checked)}
                      className="size-4 accent-primary"
                      disabled={busy}
                    />
                    Đã kiểm tra bản quyền STL (bắt buộc trước khi duyệt lên web)
                  </label>
                ) : null}
              </div>

              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                <div className="sm:col-span-2 text-xs font-semibold">File .3mf để in (nội bộ xưởng)</div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-local-3mf">Đường dẫn ổ D</Label>
                  <Input id="qe-local-3mf" value={printLocalPath} onChange={(e) => setPrintLocalPath(e.target.value)} placeholder="D:\data3D\..." disabled={busy} className="font-mono text-xs" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-drive-3mf">Link Google Drive backup</Label>
                  <Input id="qe-drive-3mf" type="url" value={printDriveUrl} onChange={(e) => setPrintDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." disabled={busy} className="text-xs" />
                </div>
              </div>

              {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p> : null}
            </div>

            <DialogFooter className="flex-wrap items-center justify-between gap-2 sm:justify-between">
              <Link
                href={`/admin/products/${item.id}`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Mở trang chi tiết <ExternalLink className="ml-1 size-3.5" />
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Huỷ</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>
                  {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                </Button>
                {item.status !== 'ACTIVE' && (!item.imported || isOwner) ? (
                  <Button type="button" disabled={busy} onClick={() => void save('ACTIVE')}>
                    <ShieldCheck className="mr-1 size-3.5" /> Lưu &amp; Đăng bán
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BulkLicenseDialog({
  open,
  onOpenChange,
  count,
  isOwner,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isOwner: boolean;
  pending: boolean;
  onSubmit: (payload: { licenseType: string; licenseSourceUrl: string | null; licenseReviewed: boolean; publish: boolean }) => void;
}) {
  const [licenseType, setLicenseType] = useState('OWN_DESIGN');
  const [licenseSourceUrl, setLicenseSourceUrl] = useState('');
  const [licenseReviewed, setLicenseReviewed] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cập nhật bản quyền ({count} sản phẩm)</DialogTitle>
          <DialogDescription>
            Áp dụng nhanh bản quyền cho các sản phẩm đang chọn. Với hàng nhập kho STL, cần tick xác nhận kiểm tra bản quyền trước khi đăng bán.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bl-type">Loại bản quyền</Label>
            <select
              id="bl-type"
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              {LICENSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bl-url">Link nguồn model chung (tuỳ chọn)</Label>
            <Input
              id="bl-url"
              type="url"
              value={licenseSourceUrl}
              onChange={(e) => setLicenseSourceUrl(e.target.value)}
              placeholder="Để trống nếu giữ nguyên từng mẫu"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={licenseReviewed}
              onChange={(e) => setLicenseReviewed(e.target.checked)}
              className="size-4 accent-primary"
            />
            Xác nhận đã kiểm tra bản quyền (cho mẫu STL)
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onSubmit({
              licenseType,
              licenseSourceUrl: licenseSourceUrl.trim() || null,
              licenseReviewed,
              publish: false,
            })}
          >
            Chỉ cập nhật
          </Button>
          {isOwner ? (
            <Button
              type="button"
              disabled={pending || licenseType === 'UNKNOWN' || !licenseReviewed}
              onClick={() => onSubmit({
                licenseType,
                licenseSourceUrl: licenseSourceUrl.trim() || null,
                licenseReviewed,
                publish: true,
              })}
            >
              Áp dụng &amp; Đăng bán
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeProductsDialog({
  open,
  onOpenChange,
  items,
  categories,
  isOwner,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogUiItem[];
  categories: CatalogCategoryOption[];
  isOwner: boolean;
  onMerged: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState<'MADE_TO_ORDER' | 'READY_STOCK'>('MADE_TO_ORDER');
  const [licenseType, setLicenseType] = useState('OWN_DESIGN');
  const [licenseSourceUrl, setLicenseSourceUrl] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [sourceCleanup, setSourceCleanup] = useState<'ARCHIVE' | 'DELETE' | 'KEEP'>('ARCHIVE');
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [rows, setRows] = useState<{ sourceProductId: string; variantName: string; priceText: string; coverUrl: string | null }[]>([]);
  const [comboEnabled, setComboEnabled] = useState(false);
  const [comboName, setComboName] = useState('Combo cả bộ');
  const [comboPriceText, setComboPriceText] = useState('');
  const [coverSourceId, setCoverSourceId] = useState<string | null>(null);
  const [customCoverImages, setCustomCoverImages] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items.length === 0) return;
    const firstCat = items.find((i) => i.categoryId && i.categorySlug !== 'chua-phan-loai')?.categoryId ?? categories[0]?.id ?? '';
    setCategoryId(firstCat);
    setName('');
    setProductType('MADE_TO_ORDER');
    const firstKnownLic = items.find((i) => i.licenseType && i.licenseType !== 'UNKNOWN')?.licenseType ?? 'OWN_DESIGN';
    setLicenseType(firstKnownLic);
    setLicenseSourceUrl(items.find((i) => i.licenseSourceUrl)?.licenseSourceUrl ?? '');
    setShortDescription('');
    setSourceCleanup('ARCHIVE');
    setPublishImmediately(isOwner);
    const mapped = items.map((item) => ({
      sourceProductId: item.id,
      variantName: item.name,
      priceText: String(item.basePrice ?? item.minPrice ?? 25000),
      coverUrl: item.coverUrl,
    }));
    setRows(mapped);
    const sum = mapped.reduce((acc, r) => acc + (Number(r.priceText) || 0), 0);
    setComboEnabled(false);
    setComboName(`Combo cả bộ ${items.length} mẫu`);
    setComboPriceText(String(Math.round((sum * 0.9) / 1000) * 1000));
    setCoverSourceId(items.find((i) => i.coverUrl)?.id ?? null);
    setCustomCoverImages([]);
    setError(null);
  }, [open, items, categories, isOwner]);

  const parsedPrices = rows.map((r) => Number(digitsOnly(r.priceText)) || 0).filter((p) => p > 0);
  const minPrice = parsedPrices.length ? Math.min(...parsedPrices) : null;
  const maxPrice = parsedPrices.length ? Math.max(...parsedPrices) : null;

  async function handleMerge() {
    setError(null);
    if (!name.trim()) { setError('Nhập tên sản phẩm gộp (VD: Clicker Động Vật Mini).'); return; }
    if (!categoryId) { setError('Chọn danh mục cho sản phẩm.'); return; }
    if (rows.length < 2) { setError('Cần ít nhất 2 mẫu để gộp.'); return; }
    const mappedItems = rows.map((r) => ({
      sourceProductId: r.sourceProductId,
      variantName: r.variantName.trim(),
      price: Number(digitsOnly(r.priceText)),
    }));
    if (mappedItems.some((r) => !r.variantName || !Number.isSafeInteger(r.price) || r.price <= 0)) {
      setError('Mỗi mẫu cần có tên biến thể và giá > 0.');
      return;
    }
    const comboPrice = comboEnabled ? Number(digitsOnly(comboPriceText)) : undefined;
    if (comboEnabled && (!comboName.trim() || !Number.isSafeInteger(comboPrice) || (comboPrice ?? 0) <= 0)) {
      setError('Nhập tên và giá hợp lệ cho biến thể Combo.');
      return;
    }

    setBusy(true);
    try {
      const res = await mergeCatalogProductsAction({
        name: name.trim(),
        categoryId,
        productType,
        shortDescription: shortDescription.trim() || null,
        licenseType,
        licenseSourceUrl: licenseSourceUrl.trim() || null,
        licenseProofUrl: null,
        isFeatured: false,
        publishImmediately: isOwner && publishImmediately && licenseType !== 'UNKNOWN',
        sourceCleanup,
        coverSourceProductId: customCoverImages.length ? null : coverSourceId,
        items: mappedItems,
        comboVariant: comboEnabled ? { enabled: true, name: comboName.trim(), price: comboPrice } : { enabled: false },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const readyCover = customCoverImages.filter((i) => i.blob && !i.error);
      if (readyCover.length) {
        try {
          await uploadProductImages(
            res.data.productId,
            readyCover.map((i) => ({ key: i.key, blob: i.blob as Blob })),
            readyCover[0].key,
            {},
          );
        } catch {
          // Non-fatal: product is created, user can upload cover on detail page
        }
      }
      onMerged(
        res.data.status === 'ACTIVE'
          ? `Đã gộp ${res.data.variantCount} mẫu thành "${res.data.name}" và đăng bán lên web (/vi/products/${res.data.slug}).`
          : `Đã gộp ${res.data.variantCount} mẫu thành bản nháp "${res.data.name}".`,
      );
    } catch {
      setError('Mất kết nối tới máy chủ. Thử lại nhé.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gộp {items.length} mẫu thành 1 sản phẩm nhiều biến thể</DialogTitle>
          <DialogDescription>
            Mỗi mẫu giữ nguyên ảnh và giá riêng. Khách mở trang sản phẩm có thể chọn từng mẫu để xem ảnh và giá tương ứng.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="mg-name">Tên sản phẩm chung *</Label>
              <Input
                id="mg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Clicker Động Vật Mini"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mg-cat">Danh mục *</Label>
              <select
                id="mg-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">— Chọn danh mục —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mg-type">Hình thức bán</Label>
              <select
                id="mg-type"
                value={productType}
                onChange={(e) => setProductType(e.target.value as 'MADE_TO_ORDER' | 'READY_STOCK')}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="MADE_TO_ORDER">In theo yêu cầu</option>
                <option value="READY_STOCK">Có sẵn, giao ngay</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mg-lic">Bản quyền</Label>
              <select
                id="mg-lic"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {LICENSE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mg-url">Link nguồn model (tuỳ chọn)</Label>
              <Input
                id="mg-url"
                type="url"
                value={licenseSourceUrl}
                onChange={(e) => setLicenseSourceUrl(e.target.value)}
                placeholder="https://makerworld.com/..."
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mg-short">Mô tả ngắn</Label>
            <Input
              id="mg-short"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="VD: Bộ sưu tập clicker mini nhiều mẫu dễ thương, chọn từng mẫu bên dưới."
              disabled={busy}
            />
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium">Ảnh bìa riêng cho sản phẩm chung (tuỳ chọn — nếu bỏ trống sẽ lấy ảnh có gắn ★ Bìa bên dưới)</p>
            <ProductImagePicker
              images={customCoverImages}
              onImagesChange={setCustomCoverImages}
              coverKey={customCoverImages[0]?.key ?? null}
              onCoverChange={() => undefined}
              allowCover={false}
              disabled={busy}
            />
          </div>

          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium">
              <span>Các mẫu biến thể ({rows.length})</span>
              <span className="tabular-nums text-muted-foreground">
                Giá hiển thị: {minPrice != null ? (minPrice === maxPrice ? formatVnd(minPrice) : `${formatVnd(minPrice)} – ${formatVnd(maxPrice)}`) : '—'}
              </span>
            </div>
            <div className="max-h-60 divide-y divide-border overflow-y-auto">
              {rows.map((row, idx) => (
                <div key={row.sourceProductId} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                    {row.coverUrl ? <img src={row.coverUrl} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-muted-foreground" />}
                  </div>
                  {row.coverUrl && !customCoverImages.length ? (
                    <button
                      type="button"
                      onClick={() => setCoverSourceId(row.sourceProductId)}
                      title="Chọn ảnh này làm ảnh bìa sản phẩm chung"
                      className={`shrink-0 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors ${
                        coverSourceId === row.sourceProductId
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      ★ Bìa
                    </button>
                  ) : null}
                  <Input
                    value={row.variantName}
                    onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, variantName: e.target.value } : r)))}
                    placeholder="Tên mẫu biến thể"
                    className="h-8 flex-1 text-sm"
                    disabled={busy}
                  />
                  <Input
                    inputMode="numeric"
                    value={row.priceText}
                    onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, priceText: digitsOnly(e.target.value) } : r)))}
                    className="h-8 w-28 text-right text-sm tabular-nums"
                    disabled={busy}
                    aria-label={`Giá ${row.variantName}`}
                  />
                  <span className="text-xs text-muted-foreground">đ</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={comboEnabled}
                onChange={(e) => setComboEnabled(e.target.checked)}
                className="size-4 accent-primary"
                disabled={busy}
              />
              Thêm biến thể Combo cả bộ
            </label>
            {comboEnabled ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input value={comboName} onChange={(e) => setComboName(e.target.value)} className="h-8 min-w-[160px] flex-1 text-sm" disabled={busy} />
                <Input inputMode="numeric" value={comboPriceText} onChange={(e) => setComboPriceText(digitsOnly(e.target.value))} className="h-8 w-28 text-right text-sm tabular-nums" disabled={busy} />
                <span className="text-xs text-muted-foreground">đ</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mg-cleanup">Sau khi gộp, xử lý {items.length} sản phẩm lẻ gốc</Label>
              <select
                id="mg-cleanup"
                value={sourceCleanup}
                onChange={(e) => setSourceCleanup(e.target.value as 'ARCHIVE' | 'DELETE' | 'KEEP')}
                disabled={busy}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="ARCHIVE">Chuyển sang Lưu trữ (khuyên dùng)</option>
                {isOwner ? <option value="DELETE">Xoá hẳn các bản lẻ gốc</option> : null}
                <option value="KEEP">Giữ nguyên các bản lẻ</option>
              </select>
            </div>
            {isOwner ? (
              <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="size-4 accent-primary"
                  disabled={busy || licenseType === 'UNKNOWN'}
                />
                Đăng bán sản phẩm gộp lên web ngay
              </label>
            ) : null}
          </div>

          {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="button" disabled={busy} onClick={() => void handleMerge()}>
            <Layers className="mr-1.5 size-4" />
            {busy ? 'Đang gộp…' : isOwner && publishImmediately && licenseType !== 'UNKNOWN' ? 'Gộp & Đăng bán' : 'Gộp thành Nháp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
