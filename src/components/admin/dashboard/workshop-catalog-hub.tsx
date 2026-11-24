'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Cloud,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Loader2,
  Package,
  Printer,
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
  customRequestsOpenCount: number;
  materialsCount: number;
}

function formatVnd(val: number | null): string {
  if (val === null || val === undefined) return 'Chưa có giá';
  return val.toLocaleString('vi-VN') + 'đ';
}

export function WorkshopCatalogHub({
  initialItems,
  categories,
  statusCounts: initialStatusCounts,
  role,
  customRequestsOpenCount,
  materialsCount,
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
    setTimeout(() => setToastMessage(null), 2800);
  }

  // Filtered list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && item.status !== 'ACTIVE') return false;
      if (statusFilter === 'DRAFT' && item.status !== 'DRAFT') return false;

      // Category filter
      if (selectedCat !== 'ALL') {
        if (item.categorySlug !== selectedCat && item.categoryName !== selectedCat) return false;
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
            ? `Đã đăng bán "${item.name}" lên showroom!`
            : `Đã chuyển "${item.name}" thành Bản nháp/Tạm ẩn!`
        );
      }
    } catch {
      // Rollback
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i))
      );
      showToast('Lỗi mạng khi cập nhật', '⚠️');
    } finally {
      setBusyId(null);
    }
  }

  // 1-Click Inline Price Edit
  async function handleEditPrice(item: WorkshopCatalogItem) {
    if (busyId) return;
    const currentPriceStr = item.basePrice ? String(item.basePrice) : '';
    const newPriceInput = window.prompt(
      `Nhập giá bán mới cho mẫu in: "${item.name}" (đơn vị: VND):`,
      currentPriceStr
    );

    if (newPriceInput === null) return;
    const cleanDigits = newPriceInput.replace(/[^\d]/g, '');
    const newPrice = cleanDigits ? Number(cleanDigits) : 0;

    if (newPrice <= 0) {
      alert('Vui lòng nhập giá lớn hơn 0đ.');
      return;
    }

    if (newPrice === item.basePrice) return;

    setBusyId(item.id);
    const oldPrice = item.basePrice;

    // Optimistic UI
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
        showToast(`Đã đổi giá thành: ${formatVnd(newPrice)}`);
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, basePrice: oldPrice } : i))
      );
      showToast('Lỗi kết nối khi đổi giá', '⚠️');
    } finally {
      setBusyId(null);
    }
  }

  // Inline Quick Name Edit
  async function handleEditName(item: WorkshopCatalogItem) {
    if (busyId) return;
    const newName = window.prompt('Sửa tên mẫu in:', item.name);
    if (!newName || !newName.trim() || newName.trim() === item.name) return;

    const trimmed = newName.trim();
    setBusyId(item.id);
    const oldName = item.name;

    // Optimistic UI
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
        showToast('Đã cập nhật tên mẫu in!');
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, name: oldName } : i))
      );
      showToast('Lỗi mạng khi cập nhật tên', '⚠️');
    } finally {
      setBusyId(null);
    }
  }

  // Delete Action
  async function confirmDeleteProduct() {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);

    try {
      if (role === 'OWNER') {
        const res = await deleteCatalogProductAction(deletingItem.id);
        if (!res.ok) {
          showToast(res.error || 'Không thể xoá mẫu này', '⚠️');
        } else {
          setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
          setStatusCounts((prev) => ({
            ...prev,
            [deletingItem.status]: Math.max(0, (prev[deletingItem.status as keyof typeof prev] || 1) - 1),
          }));
          showToast(`Đã xoá thành công: "${deletingItem.name}"`, '🗑️');
        }
      } else {
        // Staff archives instead of hard delete
        const res = await quickUpdateCatalogProductAction({
          productId: deletingItem.id,
          status: 'ARCHIVED',
        });
        if (!res.ok) {
          showToast(res.error || 'Không thể lưu trữ mẫu này', '⚠️');
        } else {
          setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
          showToast(`Đã chuyển vào kho lưu trữ: "${deletingItem.name}"`, '📦');
        }
      }
    } catch {
      showToast('Lỗi mạng khi xoá sản phẩm', '⚠️');
    } finally {
      setIsDeleting(false);
      setDeletingItem(null);
    }
  }

  function copyPathToClipboard(path: string | null) {
    if (!path) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(path).catch(() => {});
    }
    const fileName = path.split('\\').pop() || path;
    showToast(`Đã copy: ${fileName}`, '📂');
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Alert */}
      {toastMessage ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <span>{toastMessage.icon}</span>
          <span>{toastMessage.msg}</span>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deletingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10">
                <Trash2 className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">
                {role === 'OWNER' ? 'Xác nhận xoá sản phẩm' : 'Chuyển vào lưu trữ'}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc muốn {role === 'OWNER' ? 'xoá vĩnh viễn' : 'gỡ khỏi showroom'} mẫu in{' '}
              <strong className="text-foreground">&ldquo;{deletingItem.name}&rdquo;</strong> không?
            </p>
            <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingItem(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmDeleteProduct()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                <span>{role === 'OWNER' ? 'Xoá Mẫu In' : 'Lưu Trữ'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4 Quick Stat Tiles for the Workshop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Active Products Tile */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all active:scale-[0.99] ${
            statusFilter === 'ACTIVE'
              ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
              : 'border-border bg-card hover:border-emerald-500/40 hover:bg-muted/40 shadow-xs'
          }`}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Đang bán trên web</p>
            <p className="mt-0.5 text-xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-2xl">
              {statusCounts.ACTIVE} món
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 text-lg">
            <Package className="size-5" />
          </div>
        </button>

        {/* Draft Products Tile */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
          className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all active:scale-[0.99] ${
            statusFilter === 'DRAFT'
              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
              : 'border-border bg-card hover:border-amber-500/40 hover:bg-muted/40 shadow-xs'
          }`}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Bản nháp / Tạm ẩn</p>
            <p className="mt-0.5 text-xl font-bold text-amber-600 dark:text-amber-400 sm:text-2xl">
              {statusCounts.DRAFT} món
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 text-lg">
            <EyeOff className="size-5" />
          </div>
        </button>

        {/* Custom Requests Tile */}
        <Link
          href="/basaadmin/custom-requests"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-left shadow-xs transition-all hover:border-sky-500/40 hover:bg-muted/40 active:scale-[0.99]"
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Yêu cầu in chờ xử lý</p>
            <p className="mt-0.5 text-xl font-bold text-sky-600 dark:text-sky-400 sm:text-2xl">
              {customRequestsOpenCount} đơn
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 text-lg">
            <Printer className="size-5" />
          </div>
        </Link>

        {/* Materials Tile */}
        <Link
          href="/basaadmin/materials"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-left shadow-xs transition-all hover:border-purple-500/40 hover:bg-muted/40 active:scale-[0.99]"
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Kho cuộn nhựa</p>
            <p className="mt-0.5 text-xl font-bold text-purple-600 dark:text-purple-400 sm:text-2xl">
              {materialsCount} loại
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 text-lg">
            <Layers className="size-5" />
          </div>
        </Link>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pills Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCat('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCat === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted border border-transparent'
            }`}
          >
            Tất cả ({items.length})
          </button>
          {categories.map((cat) => {
            const active = selectedCat === cat.slug || selectedCat === cat.label;
            const emoji = getCategoryIconEmoji(cat.label);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.slug)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                }`}
              >
                <span>{emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Add Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên mẫu, đường dẫn file..."
              className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <Link
            href="/basaadmin/products/new"
            className={buttonVariants({
              size: 'sm',
              className: 'h-9 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold text-xs shrink-0',
            })}
          >
            <Sparkles className="size-3.5" />
            <span>+ Đăng Mẫu Mới (15s)</span>
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
              ? `Không có kết quả cho từ khoá "${searchQuery}". Thử tìm tên khác hoặc chọn lại danh mục.`
              : 'Chưa có mẫu in nào trong danh mục này. Bấm nút "+ Đăng Mẫu Mới" ở trên để thêm.'}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCat('ALL');
                setStatusFilter('ALL');
              }}
              className="mt-3 text-xs text-primary font-medium hover:underline"
            >
              Xem tất cả mẫu in
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const isActive = item.status === 'ACTIVE';
            const isBusy = busyId === item.id;
            const emoji = getCategoryIconEmoji(item.categoryName || '');
            const localFileName = item.printLocalPath ? item.printLocalPath.split('\\').pop() : null;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                    title={isActive ? 'Bấm để ẩn khỏi showroom (chuyển về nháp)' : 'Bấm để đăng bán lên showroom'}
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
                    <span>{isActive ? 'Đang bán' : 'Bản nháp'}</span>
                  </button>

                  {/* Top Right: Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeletingItem(item)}
                    title={role === 'OWNER' ? 'Xoá vĩnh viễn mẫu này' : 'Chuyển vào kho lưu trữ'}
                    className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-80 backdrop-blur-xs transition-all hover:bg-rose-600 hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Card Body */}
                <div className="flex flex-col gap-2 p-3.5">
                  {/* Category Pill */}
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <span>{emoji}</span>
                      <span>{item.categoryName || 'Chưa phân loại'}</span>
                    </span>
                  </div>

                  {/* Name (Click to inline edit) */}
                  <h4
                    onClick={() => void handleEditName(item)}
                    title="Bấm để sửa tên nhanh"
                    className="line-clamp-2 text-xs font-semibold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors"
                  >
                    {item.name}
                  </h4>

                  {/* 1-Click Price Edit */}
                  <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-1">
                    <button
                      type="button"
                      onClick={() => void handleEditPrice(item)}
                      title="Bấm vào số để sửa giá nhanh"
                      className="group/price flex items-center gap-1 text-left cursor-pointer"
                    >
                      <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {formatVnd(item.basePrice)}
                      </span>
                      <Edit2 className="size-3 text-muted-foreground opacity-60 group-hover/price:opacity-100 group-hover/price:text-primary" />
                    </button>
                    <span className="text-[10px] text-muted-foreground">Giá niêm yết</span>
                  </div>

                  {/* Workshop Local Path / Drive Button */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => copyPathToClipboard(item.printLocalPath)}
                      title={item.printLocalPath ? `Copy đường dẫn máy xưởng: ${item.printLocalPath}` : 'Chưa lưu đường dẫn máy xưởng'}
                      className={`flex-1 truncate rounded-lg border px-2 py-1 text-left font-mono text-[11px] transition-colors ${
                        item.printLocalPath
                          ? 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary'
                          : 'border-dashed border-border/60 bg-muted/20 text-muted-foreground/60 italic'
                      }`}
                    >
                      <span className="flex items-center gap-1 truncate">
                        <FolderOpen className="size-3 shrink-0 text-primary" />
                        <span className="truncate">{localFileName || 'Chưa có file local'}</span>
                      </span>
                    </button>

                    {item.printDriveUrl ? (
                      <a
                        href={item.printDriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Mở thư mục Google Drive"
                        className="flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-sky-500/40 hover:text-sky-600"
                      >
                        <Cloud className="size-3.5" />
                      </a>
                    ) : null}

                    {item.licenseSourceUrl ? (
                      <a
                        href={item.licenseSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Mở link nguồn gốc model"
                        className="flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2 text-xs">
                  <button
                    type="button"
                    onClick={() => copyPathToClipboard(item.printLocalPath)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Copy className="size-3" />
                    <span>Copy file in</span>
                  </button>

                  <Link
                    href={`/basaadmin/products/${item.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <span>Sửa chi tiết</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
