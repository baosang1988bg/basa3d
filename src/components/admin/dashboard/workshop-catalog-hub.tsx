'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Edit2,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Package,
  Search,
  Sparkles,
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
 * Tối giản, tập trung 100% vào các mẫu in xưởng đang nhận in & bán.
 * Không hiển thị dữ liệu dư thừa làm rối nhân viên (staff).
 */
export function WorkshopCatalogHub({
  initialItems,
  categories,
  statusCounts: initialStatusCounts,
  role,
}: WorkshopCatalogHubProps) {
  const [items, setItems] = useState<WorkshopCatalogItem[]>(initialItems);
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ msg: string; icon: string } | null>(null);

  // Dialog state for deleting
  const [deletingItem, setDeletingItem] = useState<WorkshopCatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function showToast(msg: string, icon = '✅') {
    setToastMessage({ msg, icon });
    setTimeout(() => setToastMessage(null), 2500);
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'ACTIVE' && item.status !== 'ACTIVE') return false;
      if (statusFilter === 'DRAFT' && item.status !== 'DRAFT') return false;

      if (selectedCat !== 'ALL') {
        if (item.categorySlug !== selectedCat && item.categoryName !== selectedCat && item.categorySlug !== selectedCat) {
          return false;
        }
      }

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

  // 1-Click Toggle Status (ACTIVE <-> DRAFT)
  async function handleToggleStatus(item: WorkshopCatalogItem) {
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
            : `Đã tạm ẩn "${item.name}"!`
        );
      }
    } catch {
      showToast('Lỗi mạng khi cập nhật trạng thái', '❌');
    } finally {
      setBusyId(null);
    }
  }

  // 1-Click Price Edit
  async function handleEditPrice(item: WorkshopCatalogItem) {
    const currentPriceStr = item.basePrice ? String(item.basePrice) : '';
    const input = window.prompt(
      `Sửa giá bán cho:\n"${item.name}"\n(Nhập số tiền VND, ví dụ: 45000):`,
      currentPriceStr
    );
    if (input === null) return;

    const newPrice = Number(input.replace(/[^\d]/g, ''));
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      alert('Vui lòng nhập số tiền hợp lệ.');
      return;
    }

    setBusyId(item.id);
    const oldPrice = item.basePrice;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, basePrice: newPrice } : i))
    );

    try {
      const res = await quickUpdateCatalogProductAction({
        productId: item.id,
        basePrice: newPrice,
      });

      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, basePrice: oldPrice } : i))
        );
        showToast(res.error || 'Cập nhật giá thất bại', '⚠️');
      } else {
        showToast(`Đã đổi giá thành ${newPrice.toLocaleString('vi-VN')}đ!`);
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

  // 1-Click Name Edit
  async function handleEditName(item: WorkshopCatalogItem) {
    const newName = window.prompt(`Sửa tên mẫu in:`, item.name);
    if (newName === null || !newName.trim() || newName.trim() === item.name) return;

    const trimmed = newName.trim();
    setBusyId(item.id);
    const oldName = item.name;
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

  // Delete product
  async function confirmDelete() {
    if (!deletingItem) return;
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
    showToast(`Đã copy: ${path}`, '📋');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toast Notification */}
      {toastMessage ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{toastMessage.icon}</span>
          <span>{toastMessage.msg}</span>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deletingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-foreground">Xác nhận xoá mẫu in?</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc muốn xoá mẫu <span className="font-semibold text-foreground">"{deletingItem.name}"</span>?
              {role !== 'OWNER' ? ' Mẫu sẽ được chuyển vào mục lưu trữ an toàn.' : ' Mẫu này sẽ bị xoá khỏi danh mục xưởng.'}
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
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Quick Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Tất cả ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-emerald-600'
            }`}
          >
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Đang bán ({statusCounts.ACTIVE})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DRAFT')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-amber-600'
            }`}
          >
            <span className="size-2 rounded-full bg-amber-500" />
            <span>Tạm ẩn ({statusCounts.DRAFT})</span>
          </button>
        </div>

        {/* Right: Search, Category Dropdown, and New Product Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            aria-label="Lọc theo danh mục"
          >
            <option value="ALL">Mọi danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {getCategoryIconEmoji(c.label)} {c.label}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên mẫu in..."
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

          {/* Add Product Button */}
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
          <h4 className="text-sm font-semibold text-foreground">Không tìm thấy mẫu in nào</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery
              ? `Không có kết quả cho từ khoá "${searchQuery}".`
              : 'Chưa có mẫu in nào trong bộ lọc này. Bấm nút "+ Đăng Mẫu Mới" để thêm.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const isActive = item.status === 'ACTIVE';
            const isBusy = busyId === item.id;
            const emoji = getCategoryIconEmoji(item.categoryName || '');

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

                  {/* Top Left: 1-Click Status Badge */}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleToggleStatus(item)}
                    title={isActive ? 'Bấm để tạm ẩn' : 'Bấm để đăng bán'}
                    className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-xs transition-all cursor-pointer ${
                      isActive
                        ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 backdrop-blur-xs'
                        : 'border border-amber-500/30 bg-amber-500/20 text-amber-800 dark:text-amber-300 backdrop-blur-xs'
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

                  {/* Top Right: Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeletingItem(item)}
                    title="Xoá mẫu in này"
                    className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 backdrop-blur-xs transition-all hover:bg-rose-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Card Body */}
                <div className="flex flex-col gap-1.5 p-3">
                  {/* Category Pill */}
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <span>{emoji}</span>
                    <span>{item.categoryName || 'Chưa phân loại'}</span>
                  </span>

                  {/* Name (Click to inline edit) */}
                  <h4
                    onClick={() => void handleEditName(item)}
                    title="Bấm để sửa tên"
                    className="line-clamp-2 text-xs font-semibold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors"
                  >
                    {item.name}
                  </h4>

                  {/* Price (Click to inline edit) */}
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => void handleEditPrice(item)}
                      title="Bấm để sửa giá"
                      className="group/price inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {formatVnd(item.basePrice)}
                      </span>
                      <Edit2 className="size-3 text-muted-foreground opacity-40 group-hover/price:opacity-100 group-hover/price:text-primary" />
                    </button>

                    <Link
                      href={`/basaadmin/products/${item.id}`}
                      className="text-[11px] font-medium text-muted-foreground hover:text-primary hover:underline"
                    >
                      Sửa chi tiết
                    </Link>
                  </div>
                </div>

                {/* Card Footer: Only shown when local file path exists */}
                {item.printLocalPath ? (
                  <div className="border-t border-border/40 bg-muted/20 px-3 py-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => copyPathToClipboard(item.printLocalPath)}
                      title={`Copy đường dẫn máy in: ${item.printLocalPath}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline truncate"
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
