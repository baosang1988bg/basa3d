'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Package,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { deleteCatalogProductAction, quickUpdateCatalogProductAction } from '@/app/basaadmin/(protected)/products/actions';
import { getCategoryIconEmoji } from '@/lib/categories';
import { buttonVariants } from '@/components/ui/button';

export interface WorkshopCatalogItem {
  id: string;
  name: string;
  slug: string;
  status: string; // 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  basePrice: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  coverUrl: string | null;
  printLocalPath: string | null;
  printDriveUrl: string | null;
  licenseSourceUrl: string | null;
  updatedAt: string;
}

export interface WorkshopCatalogHubProps {
  initialItems: WorkshopCatalogItem[];
  categories: { id: string; label: string; slug: string }[];
  statusCounts: { ACTIVE: number; DRAFT: number; ARCHIVED: number };
  role: string;
}

function formatVnd(val: number | null): string {
  if (val === null || val === undefined) return 'Chưa có giá';
  return val.toLocaleString('vi-VN') + 'đ';
}

/**
 * Giao diện Tinh Gọn Quản Lý Mẫu In Xưởng (Workshop Catalog Hub).
 * - MẶC ĐỊNH: Chỉ hiển thị các mẫu ĐANG BÁN (status === 'ACTIVE').
 * - PHÂN QUYỀN:
 *   + Ẩn/Hiện sản phẩm & Xoá sản phẩm: CHỈ OWNER mới có quyền.
 *   + Sửa tên, sửa giá, thay đổi tag/danh mục: Cả STAFF và OWNER đều làm được trực tiếp trên card.
 */
export function WorkshopCatalogHub({
  initialItems,
  categories,
  statusCounts: initialStatusCounts,
  role,
}: WorkshopCatalogHubProps) {
  const isOwner = role === 'OWNER';

  const [items, setItems] = useState<WorkshopCatalogItem[]>(initialItems);
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. MẶC ĐỊNH LÀ 'ACTIVE': Chỉ show các mẫu đang bán
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'DRAFT' | 'ALL'>('ACTIVE');

  // Inline editing states (trực quan, không dùng window.prompt)
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState<string>('');

  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState<string>('');

  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ msg: string; icon: string } | null>(null);

  // Dialog state for deleting (OWNER ONLY)
  const [deletingItem, setDeletingItem] = useState<WorkshopCatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function showToast(msg: string, icon = '✅') {
    setToastMessage({ msg, icon });
    setTimeout(() => setToastMessage(null), 2500);
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter: Default 'ACTIVE'
      if (statusFilter === 'ACTIVE' && item.status !== 'ACTIVE') return false;
      if (statusFilter === 'DRAFT' && item.status !== 'DRAFT') return false;

      // Category filter
      if (selectedCat !== 'ALL') {
        if (item.categoryId !== selectedCat && item.categorySlug !== selectedCat) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchPath = item.printLocalPath?.toLowerCase().includes(query) ?? false;
        const matchCat = item.categoryName?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchPath && !matchCat) return false;
      }

      return true;
    });
  }, [items, statusFilter, selectedCat, searchQuery]);

  // OWNER ONLY: 1-Click Toggle Status (ACTIVE <-> DRAFT)
  async function handleToggleStatus(item: WorkshopCatalogItem) {
    if (!isOwner) {
      showToast('Chỉ Chủ xưởng (Owner) mới có quyền ẩn/hiện mẫu in', '🔒');
      return;
    }
    if (busyId) return;

    const nextStatus = item.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    setBusyId(item.id);

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
    );
    setStatusCounts((prev) => ({
      ...prev,
      ACTIVE: nextStatus === 'ACTIVE' ? prev.ACTIVE + 1 : Math.max(0, prev.ACTIVE - 1),
      DRAFT: nextStatus === 'DRAFT' ? prev.DRAFT + 1 : Math.max(0, prev.DRAFT - 1),
    }));

    try {
      const res = await quickUpdateCatalogProductAction({
        productId: item.id,
        status: nextStatus,
      });

      if (!res.ok) {
        // Rollback
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i))
        );
        showToast(res.error || 'Cập nhật trạng thái thất bại', '⚠️');
      } else {
        showToast(
          nextStatus === 'ACTIVE'
            ? `Đã đăng bán "${item.name}"!`
            : `Đã chuyển "${item.name}" về tạm ẩn!`
        );
      }
    } catch {
      showToast('Lỗi mạng khi cập nhật trạng thái', '❌');
    } finally {
      setBusyId(null);
    }
  }

  // BOTH STAFF & OWNER: Save Inline Price
  async function savePrice(item: WorkshopCatalogItem) {
    const cleanNum = Number(editingPriceVal.replace(/[^\d]/g, ''));
    if (!Number.isFinite(cleanNum) || cleanNum < 0) {
      showToast('Vui lòng nhập số tiền hợp lệ', '⚠️');
      return;
    }

    const oldPrice = item.basePrice;
    setEditingPriceId(null);
    setBusyId(item.id);

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, basePrice: cleanNum } : i))
    );

    try {
      const res = await quickUpdateCatalogProductAction({
        productId: item.id,
        basePrice: cleanNum,
      });

      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, basePrice: oldPrice } : i))
        );
        showToast(res.error || 'Cập nhật giá thất bại', '⚠️');
      } else {
        showToast(`Đã đổi giá thành ${cleanNum.toLocaleString('vi-VN')}đ!`);
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, basePrice: oldPrice } : i))
      );
      showToast('Lỗi mạng khi đổi giá', '❌');
    } finally {
      setBusyId(null);
    }
  }

  // BOTH STAFF & OWNER: Save Inline Name
  async function saveName(item: WorkshopCatalogItem) {
    const trimmed = editingNameVal.trim();
    if (!trimmed || trimmed === item.name) {
      setEditingNameId(null);
      return;
    }

    const oldName = item.name;
    setEditingNameId(null);
    setBusyId(item.id);

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, name: trimmed } : i))
    );

    try {
      const res = await quickUpdateCatalogProductAction({
        productId: item.id,
        name: trimmed,
      });

      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, name: oldName } : i))
        );
        showToast(res.error || 'Đổi tên thất bại', '⚠️');
      } else {
        showToast(`Đã đổi tên thành "${trimmed}"!`);
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, name: oldName } : i))
      );
      showToast('Lỗi mạng khi đổi tên', '❌');
    } finally {
      setBusyId(null);
    }
  }

  // BOTH STAFF & OWNER: Save Category Tag Change
  async function saveCategory(item: WorkshopCatalogItem, newCatId: string) {
    setEditingCatId(null);
    if (newCatId === (item.categoryId || '')) return;

    const selectedCategory = categories.find((c) => c.id === newCatId);
    const oldCatId = item.categoryId;
    const oldCatName = item.categoryName;
    const oldCatSlug = item.categorySlug;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              categoryId: newCatId || null,
              categoryName: selectedCategory ? selectedCategory.label : null,
              categorySlug: selectedCategory ? selectedCategory.slug : null,
            }
          : i
      )
    );

    setBusyId(item.id);
    try {
      const res = await quickUpdateCatalogProductAction({
        productId: item.id,
        categoryId: newCatId || null,
      });

      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  categoryId: oldCatId,
                  categoryName: oldCatName,
                  categorySlug: oldCatSlug,
                }
              : i
          )
        );
        showToast(res.error || 'Đổi danh mục thất bại', '⚠️');
      } else {
        showToast(`Đã chuyển sang tag "${selectedCategory ? selectedCategory.label : 'Chưa phân loại'}"!`);
      }
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                categoryId: oldCatId,
                categoryName: oldCatName,
                categorySlug: oldCatSlug,
              }
            : i
        )
      );
      showToast('Lỗi mạng khi đổi tag danh mục', '❌');
    } finally {
      setBusyId(null);
    }
  }

  // OWNER ONLY: Delete product
  async function confirmDelete() {
    if (!deletingItem || !isOwner) return;
    setIsDeleting(true);
    try {
      const res = await deleteCatalogProductAction(deletingItem.id);
      if (!res.ok) {
        showToast(res.error || 'Không thể xoá mẫu này', '⚠️');
      } else {
        setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
        setStatusCounts((prev) => ({
          ...prev,
          ACTIVE: deletingItem.status === 'ACTIVE' ? Math.max(0, prev.ACTIVE - 1) : prev.ACTIVE,
          DRAFT: deletingItem.status === 'DRAFT' ? Math.max(0, prev.DRAFT - 1) : prev.DRAFT,
        }));
        showToast(`Đã xoá mẫu "${deletingItem.name}"!`, '🗑️');
        setDeletingItem(null);
      }
    } catch {
      showToast('Lỗi mạng khi xoá sản phẩm', '❌');
    } finally {
      setIsDeleting(false);
    }
  }

  function copyPathToClipboard(path: string | null) {
    if (!path) {
      showToast('Mẫu này chưa lưu đường dẫn máy xưởng', 'ℹ️');
      return;
    }
    navigator.clipboard.writeText(path);
    showToast(`Đã copy file máy: ${path}`, '📋');
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Toast Notification */}
      {toastMessage ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{toastMessage.icon}</span>
          <span>{toastMessage.msg}</span>
        </div>
      ) : null}

      {/* Delete Confirmation Modal (OWNER ONLY) */}
      {deletingItem && isOwner ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-foreground">Xác nhận xoá mẫu in?</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc muốn xoá mẫu <span className="font-semibold text-foreground">"{deletingItem.name}"</span>?
              Mẫu này sẽ bị xoá vĩnh viễn khỏi danh mục xưởng.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingItem(null)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
                className="flex items-center gap-1 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                <span>{isDeleting ? 'Đang xoá...' : 'Xác nhận xoá'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Compact Clean Toolbar */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Quick Status Filters (Owner can switch, Staff defaults to Active) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="size-2 rounded-full bg-emerald-400" />
            <span>Đang bán ({statusCounts.ACTIVE})</span>
          </button>

          {isOwner ? (
            <>
              <button
                type="button"
                onClick={() => setStatusFilter('DRAFT')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === 'DRAFT'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="size-2 rounded-full bg-amber-400" />
                <span>Tạm ẩn ({statusCounts.DRAFT})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Tất cả ({items.length})
              </button>
            </>
          ) : null}
        </div>

        {/* Right: Search, Category Tag Dropdown, and New Product Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Tag Dropdown */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            aria-label="Lọc theo danh mục"
          >
            <option value="ALL">Mọi danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {getCategoryIconEmoji(c.label)} {c.label}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên mẫu in..."
              className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Add Product Button (Both Staff & Owner can create) */}
          <Link
            href="/basaadmin/products/new"
            className={buttonVariants({
              size: 'sm',
              className: 'h-9 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold text-xs shrink-0',
            })}
          >
            <Sparkles className="size-3.5" />
            <span>+ Đăng Mẫu Mới</span>
          </Link>
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Package className="size-10 text-muted-foreground/60 mb-2" />
          <h4 className="text-sm font-semibold text-foreground">Không có mẫu in nào</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery
              ? `Không tìm thấy mẫu in nào khớp với "${searchQuery}".`
              : statusFilter === 'ACTIVE'
                ? 'Hiện chưa có mẫu nào đang đăng bán trên web. Bấm "+ Đăng Mẫu Mới" để thêm mẫu in.'
                : 'Chưa có mẫu nào trong trạng thái này.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const isActive = item.status === 'ACTIVE';
            const isBusy = busyId === item.id;
            const emoji = getCategoryIconEmoji(item.categoryName || '');
            const isEditingName = editingNameId === item.id;
            const isEditingPrice = editingPriceId === item.id;
            const isEditingCat = editingCatId === item.id;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                {/* Product Cover Image */}
                <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/40 border-b border-border/60">
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt={item.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted/60 to-muted/20 text-3xl select-none">
                      {emoji || '📦'}
                    </div>
                  )}

                  {/* Top Left: Status (OWNER has toggle, STAFF sees static badge) */}
                  {isOwner ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggleStatus(item)}
                      title={isActive ? 'Bấm để ẩn khỏi web (Owner)' : 'Bấm để đăng bán lên web (Owner)'}
                      className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-xs transition-all cursor-pointer ${
                        isActive
                          ? 'border border-emerald-500/30 bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 backdrop-blur-xs hover:bg-emerald-500/40'
                          : 'border border-amber-500/30 bg-amber-500/25 text-amber-800 dark:text-amber-300 backdrop-blur-xs hover:bg-amber-500/40'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isActive ? (
                        <Eye className="size-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <EyeOff className="size-3 text-amber-600 dark:text-amber-400" />
                      )}
                      <span>{isActive ? 'Đang bán' : 'Tạm ẩn'}</span>
                    </button>
                  ) : (
                    <div
                      title="Chỉ Owner mới có quyền ẩn/hiện sản phẩm"
                      className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-xs border border-emerald-500/30 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 backdrop-blur-xs select-none"
                    >
                      <Eye className="size-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Đang bán</span>
                    </div>
                  )}

                  {/* Top Right: Delete Button (OWNER ONLY) */}
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      title="Xoá mẫu in này (Chỉ Owner)"
                      className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 backdrop-blur-xs transition-all hover:bg-rose-600 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Card Body */}
                <div className="flex flex-col gap-2 p-3">
                  {/* Tag / Danh mục: Click để chọn thay đổi tag trực tiếp */}
                  <div className="relative">
                    {isEditingCat ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={item.categoryId || ''}
                          onChange={(e) => void saveCategory(item, e.target.value)}
                          onBlur={() => setEditingCatId(null)}
                          autoFocus
                          className="h-6.5 rounded-md border border-primary bg-background px-1.5 text-[11px] font-medium text-foreground focus:outline-none"
                        >
                          <option value="">-- Chưa phân loại --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {getCategoryIconEmoji(c.label)} {c.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingCatId(item.id)}
                        title="Bấm để đổi tag danh mục"
                        className="group/tag inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      >
                        <span>{emoji}</span>
                        <span className="truncate max-w-[140px]">{item.categoryName || 'Chưa phân loại'}</span>
                        <Tag className="size-2.5 opacity-40 group-hover/tag:opacity-100 text-primary" />
                      </button>
                    )}
                  </div>

                  {/* Name: Click to inline edit directly on card */}
                  {isEditingName ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingNameVal}
                        onChange={(e) => setEditingNameVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveName(item);
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                        autoFocus
                        placeholder="Nhập tên mẫu in..."
                        className="h-7.5 flex-1 rounded-md border border-primary bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => void saveName(item)}
                        title="Lưu tên"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNameId(null)}
                        title="Huỷ"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="group/name flex items-start justify-between gap-1">
                      <h4
                        onClick={() => {
                          setEditingNameId(item.id);
                          setEditingNameVal(item.name);
                        }}
                        title="Bấm để sửa tên trực tiếp"
                        className="line-clamp-2 text-xs font-semibold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors flex-1"
                      >
                        {item.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNameId(item.id);
                          setEditingNameVal(item.name);
                        }}
                        title="Sửa tên"
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 text-muted-foreground hover:text-primary transition-opacity shrink-0"
                      >
                        <Edit2 className="size-3" />
                      </button>
                    </div>
                  )}

                  {/* Price: Click to inline edit price */}
                  {isEditingPrice ? (
                    <div className="flex items-center gap-1 pt-1">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingPriceVal}
                          onChange={(e) => setEditingPriceVal(e.target.value.replace(/[^\d]/g, ''))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void savePrice(item);
                            if (e.key === 'Escape') setEditingPriceId(null);
                          }}
                          autoFocus
                          placeholder="Nhập giá..."
                          className="h-7 w-full rounded-md border border-primary bg-background pl-2 pr-6 font-mono text-xs font-bold text-emerald-600 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="absolute right-1.5 top-1.5 text-[10px] font-bold text-muted-foreground">đ</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void savePrice(item)}
                        title="Lưu giá"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPriceId(null)}
                        title="Huỷ"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceId(item.id);
                          setEditingPriceVal(item.basePrice ? String(item.basePrice) : '');
                        }}
                        title="Bấm để sửa giá bán trực tiếp"
                        className="group/price inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      >
                        <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatVnd(item.basePrice)}
                        </span>
                        <Edit2 className="size-3 text-muted-foreground opacity-30 group-hover/price:opacity-100 group-hover/price:text-emerald-600 transition-opacity" />
                      </button>

                      <Link
                        href={`/basaadmin/products/${item.id}`}
                        className="text-[11px] font-medium text-muted-foreground hover:text-primary hover:underline"
                      >
                        Chi tiết
                      </Link>
                    </div>
                  )}
                </div>

                {/* Footer: 1-Click Copy Local Machine File (Only when local path exists) */}
                {item.printLocalPath ? (
                  <div className="border-t border-border/40 bg-muted/20 px-3 py-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => copyPathToClipboard(item.printLocalPath)}
                      title={`Copy đường dẫn máy in: ${item.printLocalPath}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline truncate"
                    >
                      <FolderOpen className="size-3 shrink-0" />
                      <span className="truncate">Copy file máy xưởng</span>
                    </button>
                    <Copy className="size-3 text-muted-foreground shrink-0" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
