'use client';

// Kho & giá sản phẩm (/admin/product-inventory).
// UX review 2026-10-27 (Phase 52 follow-up): the old page mixed stock and pricing for every product,
// counted MADE_TO_ORDER products (80–90% of the catalogue, Rule #9: no finished-goods stock) as
// "Hết hàng – cần in ngay", and repeated the same numbers in KPI cards, pill lists, filter pills and
// badges. Now: two tabs by how a product is sold; the stock tab is one list of variant rows (stock is
// per variant, so is "Nhập kho"), sorted by urgency, with the status chips doubling as the summary.
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Boxes, Calculator, Check, ExternalLink, Loader2, Package, Pencil, Plus, Printer, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  computePricingBreakdown,
  resolveMaterialUnitCostVndPerGram,
  type PricingBreakdown,
} from '@/services/pricing.service';
import type { ProductInventoryItem } from '@/services/product.service';
import { QuickRestockButton } from '@/components/admin/quick-restock-dialog';
import { BatchRestockButton } from '@/components/admin/batch-restock-dialog';
import type { StockTrackedVariant } from '@/services/quick-restock.service';
import type { PricingConfigRow } from '@/services/pricing-config.service';
import {
  applyPricingCalculationAction,
  updateProductBasePriceAction,
  updateVariantPriceAction,
} from '@/app/admin/(protected)/product-inventory/actions';

export type PricingMaterialOption = {
  id: string;
  name: string;
  unit: string;
  materialType: string;
  costPerSpool: number | null;
  spoolWeightGrams: number | null;
  currentUnitCost: number | null;
};

interface Props {
  products: ProductInventoryItem[];
  categories: { id: string; name: string }[];
  materials: PricingMaterialOption[];
  pricingConfig: PricingConfigRow | null;
  /** Phase 52 P4: picker data for "Nhập theo mẻ". */
  batchVariants: StockTrackedVariant[];
  warehouses: { id: string; name: string; code: string }[];
}

type Tab = 'STOCK' | 'MADE_TO_ORDER';
type StockStatus = 'OUT' | 'LOW' | 'OK';
type StatusFilter = 'ALL' | StockStatus;

/** "Sắp hết" threshold, per variant (units still sellable). */
const LOW_STOCK_MAX = 5;

const STATUS_META: Record<StockStatus, { label: string; dot: string; text: string; chip: string }> = {
  OUT: { label: 'Hết hàng', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', chip: 'data-[active=true]:border-rose-500 data-[active=true]:bg-rose-500/10' },
  LOW: { label: 'Sắp hết', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', chip: 'data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500/10' },
  OK: { label: 'Còn hàng', dot: 'bg-emerald-500', text: 'text-foreground', chip: 'data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-500/10' },
};
const STATUS_ORDER: Record<StockStatus, number> = { OUT: 0, LOW: 1, OK: 2 };

function stockStatus(available: number): StockStatus {
  if (available <= 0) return 'OUT';
  if (available <= LOW_STOCK_MAX) return 'LOW';
  return 'OK';
}

function formatVnd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('vi-VN')}đ`;
}

function priceRange(prices: number[]): string {
  if (!prices.length) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function ProductInventoryManager({
  products,
  categories,
  materials,
  pricingConfig,
  batchVariants,
  warehouses,
}: Props) {
  const [tab, setTab] = useState<Tab>('STOCK');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Inline price edit state
  const [editingPriceTarget, setEditingPriceTarget] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<string>('');
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [saveSuccessTarget, setSaveSuccessTarget] = useState<string | null>(null);

  // Pricing calculator dialog state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState<{
    productId: string;
    productName: string;
    variantId?: string;
    variantSku?: string;
    currentPrice?: number | null;
  } | null>(null);

  const [calcMaterialId, setCalcMaterialId] = useState<string>('');
  const effectiveMaterialId = calcMaterialId || materials[0]?.id || '';
  const [calcGrams, setCalcGrams] = useState<string>('50');
  const [calcPrintHours, setCalcPrintHours] = useState<string>('2');
  const [calcPrintMinutes, setCalcPrintMinutes] = useState<string>('30');
  const [calcLaborMinutes, setCalcLaborMinutes] = useState<string>('15');

  const [isPending, startTransition] = useTransition();

  const stockProducts = useMemo(() => products.filter((p) => p.productType === 'READY_STOCK'), [products]);
  const orderProducts = useMemo(() => products.filter((p) => p.productType !== 'READY_STOCK'), [products]);

  const matchesText = useMemo(() => {
    const needle = fold(search.trim());
    return (product: ProductInventoryItem) => {
      if (categoryFilter !== 'ALL' && product.categoryId !== categoryFilter) return false;
      if (!needle) return true;
      const haystack = fold([product.name, product.slug, ...product.variants.flatMap((v) => [v.name, v.sku])].join(' '));
      return needle.split(/\s+/).every((word) => haystack.includes(word));
    };
  }, [search, categoryFilter]);

  // Stock tab: one row per sellable variant; the chips count rows so "Hết hàng (3)" = 3 rows to restock.
  const stockRows = useMemo(() => {
    const rows = stockProducts
      .filter(matchesText)
      .flatMap((product) => product.variants
        .filter((variant) => variant.isActive)
        .map((variant) => ({ product, variant, status: stockStatus(variant.available) })));
    return rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || a.variant.available - b.variant.available
      || a.product.name.localeCompare(b.product.name, 'vi'));
  }, [stockProducts, matchesText]);

  const statusCounts = useMemo(() => {
    const counts: Record<StockStatus, number> = { OUT: 0, LOW: 0, OK: 0 };
    for (const row of stockRows) counts[row.status] += 1;
    return counts;
  }, [stockRows]);

  const visibleStockRows = statusFilter === 'ALL' ? stockRows : stockRows.filter((row) => row.status === statusFilter);
  const visibleOrderProducts = useMemo(() => orderProducts.filter(matchesText), [orderProducts, matchesText]);
  const hasFilters = Boolean(search) || categoryFilter !== 'ALL' || statusFilter !== 'ALL';

  // Calculation in Pricing Dialog
  const calculatedBreakdown = useMemo<PricingBreakdown | null>(() => {
    if (!pricingConfig) return null;
    const material = materials.find((m) => m.id === effectiveMaterialId);
    if (!material) return null;

    const grams = Number(calcGrams);
    const pHours = Number(calcPrintHours) || 0;
    const pMinutes = Number(calcPrintMinutes) || 0;
    const totalPrintMinutes = pHours * 60 + pMinutes;
    const laborMin = Number(calcLaborMinutes) || 0;

    if (!Number.isFinite(grams) || grams <= 0 || totalPrintMinutes <= 0) {
      return null;
    }

    try {
      const unitCost = resolveMaterialUnitCostVndPerGram(material);
      return computePricingBreakdown({
        materials: [{ label: material.name, gram: grams, unitCostVndPerGram: unitCost }],
        printMinutes: totalPrintMinutes,
        laborMinutes: laborMin,
        config: pricingConfig,
      });
    } catch {
      return null;
    }
  }, [pricingConfig, materials, effectiveMaterialId, calcGrams, calcPrintHours, calcPrintMinutes, calcLaborMinutes]);

  function handleStartInlineEdit(targetKey: string, currentPrice: number | null) {
    setEditingPriceTarget(targetKey);
    setInlinePriceValue(currentPrice != null ? String(currentPrice) : '');
  }

  function handleCancelInlineEdit() {
    setEditingPriceTarget(null);
    setInlinePriceValue('');
  }

  function handleSaveInlinePrice(productId: string, variantId?: string) {
    const parsedPrice = Number(inlinePriceValue);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      alert('Vui lòng nhập giá hợp lệ (số nguyên không âm)');
      return;
    }

    const targetKey = variantId ? `v-${variantId}` : `p-${productId}`;
    setSavingTarget(targetKey);

    startTransition(async () => {
      try {
        if (variantId) {
          await updateVariantPriceAction(variantId, parsedPrice);
        } else {
          await updateProductBasePriceAction(productId, parsedPrice);
        }
        setEditingPriceTarget(null);
        setSaveSuccessTarget(targetKey);
        setTimeout(() => setSaveSuccessTarget(null), 3000);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Lỗi khi cập nhật giá');
      } finally {
        setSavingTarget(null);
      }
    });
  }

  function openCalculator(target: {
    productId: string;
    productName: string;
    variantId?: string;
    variantSku?: string;
    currentPrice?: number | null;
    weightGrams?: number | null;
  }) {
    setCalcTarget({
      productId: target.productId,
      productName: target.productName,
      variantId: target.variantId,
      variantSku: target.variantSku,
      currentPrice: target.currentPrice,
    });
    if (target.weightGrams && target.weightGrams > 0) {
      setCalcGrams(String(target.weightGrams));
    }
    setCalculatorOpen(true);
  }

  function handleApplyCalculatedPrice() {
    if (!calcTarget || !calculatedBreakdown || !pricingConfig) return;

    startTransition(async () => {
      try {
        await applyPricingCalculationAction({
          productId: calcTarget.productId,
          variantId: calcTarget.variantId,
          price: calculatedBreakdown.finalPriceVnd,
          breakdown: calculatedBreakdown,
          pricingConfigId: pricingConfig.id,
        });
        setCalculatorOpen(false);
        const targetKey = calcTarget.variantId ? `v-${calcTarget.variantId}` : `p-${calcTarget.productId}`;
        setSaveSuccessTarget(targetKey);
        setTimeout(() => setSaveSuccessTarget(null), 3000);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Lỗi khi áp dụng giá');
      }
    });
  }

  function clearAllFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
  }

  function priceCell(target: { key: string; productId: string; variantId?: string; price: number | null }) {
    const isEditing = editingPriceTarget === target.key;
    const isSaving = savingTarget === target.key;
    if (isEditing) {
      return (
        <div className="flex items-center justify-end gap-1">
          <Input
            type="number"
            min={0}
            value={inlinePriceValue}
            onChange={(e) => setInlinePriceValue(e.target.value)}
            className="h-8 w-28 text-right text-sm tabular-nums"
            autoFocus
            aria-label="Giá mới (đ)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveInlinePrice(target.productId, target.variantId);
              if (e.key === 'Escape') handleCancelInlineEdit();
            }}
          />
          <Button size="sm" className="h-8 px-2" disabled={isSaving || isPending} onClick={() => handleSaveInlinePrice(target.productId, target.variantId)} aria-label="Lưu giá">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleCancelInlineEdit} aria-label="Huỷ sửa giá">
            <X className="size-3.5" />
          </Button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handleStartInlineEdit(target.key, target.price)}
        className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium tabular-nums hover:bg-muted"
        title="Bấm để sửa giá"
      >
        {saveSuccessTarget === target.key ? <Check className="size-3.5 text-emerald-600" /> : null}
        {formatVnd(target.price)}
        <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  const tabButton = (value: Tab, icon: React.ReactNode, label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => { setTab(value); setStatusFilter('ALL'); }}
      className={`flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {icon}
      {label}
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kho &amp; giá sản phẩm</h1>
          <p className="text-sm text-muted-foreground">Hàng có sẵn: xem còn bao nhiêu và nhập kho. Hàng in theo yêu cầu: chỉ quản lý giá.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Boxes className="mr-1.5 size-4" /> Sổ kho
          </Link>
          <BatchRestockButton variants={batchVariants} warehouses={warehouses} />
          <Link href="/admin/products/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="mr-1.5 size-4" /> Đăng sản phẩm mới
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Hình thức bán" className="flex gap-6 border-b border-border">
        {tabButton('STOCK', <Package className="size-4" />, 'Hàng có sẵn', stockProducts.length)}
        {tabButton('MADE_TO_ORDER', <Printer className="size-4" />, 'In theo yêu cầu', orderProducts.length)}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên mẫu, màu hoặc SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Tìm sản phẩm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Danh mục"
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm sm:w-56"
          >
            <option value="ALL">Mọi danh mục</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {tab === 'STOCK' ? (
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Tình trạng tồn">
            <button
              type="button" role="radio" aria-checked={statusFilter === 'ALL'} data-active={statusFilter === 'ALL'}
              onClick={() => setStatusFilter('ALL')}
              className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:bg-muted data-[active=true]:border-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
            >
              Tất cả <span className="tabular-nums">{stockRows.length}</span>
            </button>
            {(['OUT', 'LOW', 'OK'] as StockStatus[]).map((status) => (
              <button
                key={status} type="button" role="radio" aria-checked={statusFilter === status} data-active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-colors hover:bg-muted ${STATUS_META[status].chip}`}
              >
                <span className={`size-2 rounded-full ${STATUS_META[status].dot}`} />
                {STATUS_META[status].label} <span className="tabular-nums font-semibold">{statusCounts[status]}</span>
              </button>
            ))}
            <span className="text-xs text-muted-foreground">Sắp hết = còn 1–{LOW_STOCK_MAX} món bán được.</span>
          </div>
        ) : null}
      </div>

      {/* Stock tab — one row per variant, most urgent first */}
      {tab === 'STOCK' ? (
        visibleStockRows.length ? (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_130px_auto] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span>Sản phẩm</span>
              <span className="text-right">Còn bán được</span>
              <span className="text-right">Giá bán</span>
              <span className="w-[200px]" />
            </div>
            <ul className="divide-y divide-border">
              {visibleStockRows.map(({ product, variant, status }) => (
                <li key={variant.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_130px_auto]">
                  {/* Product */}
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${STATUS_META[status].dot}`} title={STATUS_META[status].label} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Link href={`/admin/products/${product.id}`} className="truncate font-medium hover:underline">{product.name}</Link>
                        {product.status !== 'ACTIVE' ? <Badge variant="outline" className="text-[10px]">{product.status === 'DRAFT' ? 'Nháp' : 'Đã lưu trữ'}</Badge> : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {variant.name} · <span className="font-mono">{variant.sku}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sellable */}
                  <div className="text-right">
                    <div className={`text-lg font-semibold leading-tight tabular-nums ${STATUS_META[status].text}`}>{variant.available}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {variant.onHand} trên kệ{variant.reserved > 0 ? ` · ${variant.reserved} giữ cho đơn` : ''}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 flex items-center justify-between md:col-span-1 md:justify-end">
                    <span className="text-xs text-muted-foreground md:hidden">Giá bán</span>
                    {priceCell({ key: `v-${variant.id}`, productId: product.id, variantId: variant.id, price: variant.price })}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1 md:w-[200px]">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground"
                      title="Tính giá đề xuất"
                      aria-label={`Tính giá ${product.name} ${variant.name}`}
                      onClick={() => openCalculator({ productId: product.id, productName: product.name, variantId: variant.id, variantSku: variant.sku, currentPrice: variant.price, weightGrams: variant.weightGrams })}
                    >
                      <Calculator className="size-4" />
                    </Button>
                    <QuickRestockButton
                      variants={[{ id: variant.id, sku: variant.sku, name: variant.name }]}
                      productName={product.name}
                      className={status === 'OK' ? 'h-8' : 'h-8 border-primary/40'}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState
            title={stockProducts.length ? 'Không có dòng nào khớp bộ lọc' : 'Chưa có sản phẩm hàng có sẵn'}
            hint={stockProducts.length ? 'Thử bỏ bớt bộ lọc.' : 'Khi đăng sản phẩm, chọn “Có sẵn, giao ngay” để quản lý tồn kho ở đây.'}
            onClear={hasFilters ? clearAllFilters : undefined}
          />
        )
      ) : null}

      {/* Made-to-order tab — price only, no stock (Rule #9) */}
      {tab === 'MADE_TO_ORDER' ? (
        visibleOrderProducts.length ? (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1fr)_150px_170px_auto] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span>Sản phẩm</span>
              <span className="text-right">Giá cơ bản</span>
              <span className="text-right">Giá theo màu</span>
              <span className="w-[88px]" />
            </div>
            <ul className="divide-y divide-border">
              {visibleOrderProducts.map((product) => {
                const activeVariants = product.variants.filter((v) => v.isActive);
                return (
                  <li key={product.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_170px_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Link href={`/admin/products/${product.id}`} className="truncate font-medium hover:underline">{product.name}</Link>
                        {product.status !== 'ACTIVE' ? <Badge variant="outline" className="text-[10px]">{product.status === 'DRAFT' ? 'Nháp' : 'Đã lưu trữ'}</Badge> : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {product.categoryName ?? 'Chưa có danh mục'} · {activeVariants.length} màu/biến thể
                      </div>
                    </div>
                    <div className="text-right">
                      {priceCell({ key: `p-${product.id}`, productId: product.id, price: product.basePrice })}
                    </div>
                    <div className="col-span-2 flex items-center justify-between text-sm tabular-nums md:col-span-1 md:justify-end">
                      <span className="text-xs text-muted-foreground md:hidden">Giá theo màu</span>
                      {priceRange(activeVariants.map((v) => v.price))}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1 md:w-[88px]">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-muted-foreground"
                        title="Tính giá đề xuất"
                        aria-label={`Tính giá ${product.name}`}
                        onClick={() => openCalculator({ productId: product.id, productName: product.name, currentPrice: product.basePrice })}
                      >
                        <Calculator className="size-4" />
                      </Button>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 px-2 text-muted-foreground' })}
                        title="Mở trang chi tiết"
                        aria-label={`Mở ${product.name}`}
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <EmptyState
            title={orderProducts.length ? 'Không có sản phẩm nào khớp bộ lọc' : 'Chưa có sản phẩm in theo yêu cầu'}
            hint={orderProducts.length ? 'Thử bỏ bớt bộ lọc.' : 'Đăng sản phẩm mới và chọn “In theo yêu cầu”.'}
            onClear={hasFilters ? clearAllFilters : undefined}
          />
        )
      ) : null}

      {/* Pricing Calculator Modal */}
      <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calculator className="size-5 text-primary" />
              Cấu hình &amp; Tính giá in 3D
            </DialogTitle>
            <DialogDescription>
              Tính toán giá bán tối ưu dựa trên cấu hình xưởng (tiền điện, khấu hao, hao hụt, nhân công &amp; biên lợi nhuận).
            </DialogDescription>
          </DialogHeader>

          {calcTarget && (
            <div className="flex flex-col gap-4 py-2">
              {/* Target Notice */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1 border border-border/80">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mẫu sản phẩm:</span>
                  <span className="font-semibold text-foreground">{calcTarget.productName}</span>
                </div>
                {calcTarget.variantSku && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phân loại / SKU:</span>
                    <span className="font-mono font-medium">{calcTarget.variantSku}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Giá bán hiện tại:</span>
                  <span className="font-semibold text-primary">{formatVnd(calcTarget.currentPrice)}</span>
                </div>
              </div>

              {/* Calculator Inputs */}
              <div className="grid grid-cols-2 gap-3">
                {/* Material */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="calc-mat" className="text-xs font-medium">Cuộn nhựa / Loại vật liệu</Label>
                  <select
                    id="calc-mat"
                    value={effectiveMaterialId}
                    onChange={(e) => setCalcMaterialId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {materials.map((m) => {
                      const costPerGram = resolveMaterialUnitCostVndPerGram(m);
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.materialType}) — {costPerGram.toLocaleString('vi-VN')}đ/g
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Weight */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calc-weight" className="text-xs font-medium">Khối lượng in (grams)</Label>
                  <Input
                    id="calc-weight"
                    type="number"
                    min={1}
                    value={calcGrams}
                    onChange={(e) => setCalcGrams(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="VD: 65"
                  />
                </div>

                {/* Labor time */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calc-labor" className="text-xs font-medium">Thời gian nhân công (phút)</Label>
                  <Input
                    id="calc-labor"
                    type="number"
                    min={0}
                    value={calcLaborMinutes}
                    onChange={(e) => setCalcLaborMinutes(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="VD: 15"
                  />
                </div>

                {/* Print hours */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calc-hours" className="text-xs font-medium">Thời gian in: Giờ</Label>
                  <Input
                    id="calc-hours"
                    type="number"
                    min={0}
                    value={calcPrintHours}
                    onChange={(e) => setCalcPrintHours(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="VD: 3"
                  />
                </div>

                {/* Print minutes */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calc-mins" className="text-xs font-medium">Thời gian in: Phút</Label>
                  <Input
                    id="calc-mins"
                    type="number"
                    min={0}
                    max={59}
                    value={calcPrintMinutes}
                    onChange={(e) => setCalcPrintMinutes(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="VD: 45"
                  />
                </div>
              </div>

              {/* Live Cost Breakdown */}
              {calculatedBreakdown ? (
                <div className="rounded-lg border border-border/80 bg-card p-3 text-xs flex flex-col gap-2">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Chi tiết giá vốn &amp; Lợi nhuận
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tiền nhựa:</span>
                      <span>{formatVnd(calculatedBreakdown.materialCostVnd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tiền điện:</span>
                      <span>{formatVnd(calculatedBreakdown.electricityCostVnd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Khấu hao máy:</span>
                      <span>{formatVnd(calculatedBreakdown.machineDepreciationVnd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nhân công:</span>
                      <span>{formatVnd(calculatedBreakdown.laborCostVnd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dự phòng lỗi:</span>
                      <span>{formatVnd(calculatedBreakdown.failureBufferVnd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Đóng gói:</span>
                      <span>{formatVnd(calculatedBreakdown.packagingFeeVnd)}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/70 pt-2 flex items-center justify-between font-medium">
                    <span className="text-muted-foreground">Tổng chi phí sản xuất:</span>
                    <span>{formatVnd(calculatedBreakdown.totalCostVnd)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-primary/10 p-2 font-bold text-sm text-primary">
                    <span>Giá bán đề xuất:</span>
                    <span className="text-base">{formatVnd(calculatedBreakdown.finalPriceVnd)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-500 text-center py-2">
                  Vui lòng nhập đầy đủ khối lượng (&gt; 0g) và thời gian in.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalculatorOpen(false)}
            >
              Đóng
            </Button>
            <Button
              size="sm"
              disabled={!calculatedBreakdown || isPending}
              onClick={handleApplyCalculatedPrice}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 size-3.5" />
                  Áp dụng giá này ({formatVnd(calculatedBreakdown?.finalPriceVnd)})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ title, hint, onClear }: { title: string; hint: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Package className="size-8 text-muted-foreground/60" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {onClear ? <Button variant="outline" size="sm" className="mt-2" onClick={onClear}>Xoá bộ lọc</Button> : null}
    </div>
  );
}
