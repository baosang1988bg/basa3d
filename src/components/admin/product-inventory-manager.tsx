'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

function formatVnd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('vi-VN')}đ`;
}

function getVariantStockStatus(available: number) {
  if (available > 5) {
    return {
      label: `Còn hàng (${available} cái)`,
      badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    };
  }
  if (available > 0) {
    return {
      label: `Gần hết (${available} cái)`,
      badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    };
  }
  return {
    label: `Hết hàng (0 cái)`,
    badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  };
}

export function ProductInventoryManager({
  products,
  categories,
  materials,
  pricingConfig,
}: Props) {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

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
  const [calcGrams, setCalcGrams] = useState<string>('50');
  const [calcPrintHours, setCalcPrintHours] = useState<string>('2');
  const [calcPrintMinutes, setCalcPrintMinutes] = useState<string>('30');
  const [calcLaborMinutes, setCalcLaborMinutes] = useState<string>('15');

  const [isPending, startTransition] = useTransition();

  // Initialize first material
  useMemo(() => {
    if (!calcMaterialId && materials.length > 0) {
      setCalcMaterialId(materials[0].id);
    }
  }, [materials, calcMaterialId]);

  // Overall statistics oriented around product models (Mẫu: Zoro, Luffy, Sanji...) and actual physical unit count
  const stats = useMemo(() => {
    let totalAvailableUnits = 0;
    let totalOnHandUnits = 0;
    let totalReservedUnits = 0;

    const inStockModels: ProductInventoryItem[] = [];
    const lowStockModels: ProductInventoryItem[] = [];
    const outOfStockModels: ProductInventoryItem[] = [];

    for (const p of products) {
      totalOnHandUnits += p.totalOnHand;
      totalReservedUnits += p.totalReserved;
      if (p.totalAvailable > 0) {
        totalAvailableUnits += p.totalAvailable;
      }

      if (p.totalAvailable > 5) {
        inStockModels.push(p);
      } else if (p.totalAvailable > 0) {
        lowStockModels.push(p);
      } else {
        outOfStockModels.push(p);
      }
    }

    return {
      totalProducts: products.length,
      totalAvailableUnits,
      totalOnHandUnits,
      totalReservedUnits,
      inStockModels,
      lowStockModels,
      outOfStockModels,
    };
  }, [products]);

  // Filtered product list
  const filteredProducts = useMemo(() => {
    const queryTerm = search.trim().toLowerCase();

    return products.filter((p) => {
      // Category filter
      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) {
        return false;
      }

      // Product type filter
      if (typeFilter !== 'ALL' && p.productType !== typeFilter) {
        return false;
      }

      // Stock status filter by model available units
      if (stockFilter === 'IN_STOCK' && p.totalAvailable <= 5) return false;
      if (stockFilter === 'LOW_STOCK' && (p.totalAvailable <= 0 || p.totalAvailable > 5)) return false;
      if (stockFilter === 'OUT_OF_STOCK' && p.totalAvailable > 0) return false;

      // Text search in product name, slug, or any variant SKU
      if (queryTerm) {
        const matchesName = p.name.toLowerCase().includes(queryTerm);
        const matchesSlug = p.slug.toLowerCase().includes(queryTerm);
        const matchesSku = p.variants.some(
          (v) => v.sku.toLowerCase().includes(queryTerm) || v.name.toLowerCase().includes(queryTerm),
        );
        if (!matchesName && !matchesSlug && !matchesSku) return false;
      }

      return true;
    });
  }, [products, search, categoryFilter, typeFilter, stockFilter]);

  // Calculation in Pricing Dialog
  const calculatedBreakdown = useMemo<PricingBreakdown | null>(() => {
    if (!pricingConfig) return null;
    const material = materials.find((m) => m.id === calcMaterialId);
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
  }, [pricingConfig, materials, calcMaterialId, calcGrams, calcPrintHours, calcPrintMinutes, calcLaborMinutes]);

  function toggleExpand(productId: string) {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: prev[productId] === undefined ? false : !prev[productId],
    }));
  }

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
    setStockFilter('ALL');
    setCategoryFilter('ALL');
    setTypeFilter('ALL');
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Kho sản phẩm &amp; Cấu hình giá</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi số lượng mẫu có sẵn, phát hiện các mẫu gần hết để kịp thời in bổ sung và cấu hình giá nhanh.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          <Link
            href="/admin/inventory"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Boxes className="mr-1.5 size-4" />
            Sổ kho biến động
          </Link>
          <Link
            href="/admin/products"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Plus className="mr-1.5 size-4" />
            Tạo mẫu sản phẩm mới
          </Link>
        </div>
      </div>

      {/* KPI Cards: Updated colors & logic around product models and item count */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Số lượng sản phẩm mình có */}
        <Card className="border-border/70 bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Số lượng sẵn có
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Boxes className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.totalAvailableUnits} <span className="text-sm font-medium text-muted-foreground">cái / sp</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng số lượng của {stats.inStockModels.length + stats.lowStockModels.length} mẫu có sẵn sàng giao
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Mẫu đang đủ hàng */}
        <Card className="border-border/70 bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mẫu đang đủ hàng
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {stats.inStockModels.length} <span className="text-sm font-medium text-muted-foreground">mẫu</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Còn từ 6 cái trở lên (như Zoro, Luffy...)
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Mấy loại gần hết */}
        <Card className="border-border/70 bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mẫu gần hết hàng
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <AlertTriangle className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
              {stats.lowStockModels.length} <span className="text-sm font-medium text-muted-foreground">mẫu</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Còn từ 1 – 5 cái, cần chuẩn bị in bổ sung
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Mấy loại hết */}
        <Card className="border-border/70 bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mẫu đã hết hàng
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-600">
              <AlertCircle className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
              {stats.outOfStockModels.length} <span className="text-sm font-medium text-muted-foreground">mẫu</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Hết sạch tồn kho (0 cái), cần in ngay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Model Expansion & Quick Action Center (Mở rộng theo từng mẫu: Zoro, Luffy, Sanji...) */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-2xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Theo dõi nhanh theo từng mẫu (Zoro, Luffy, Sanji...):
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Bấm trực tiếp vào tên mẫu bên dưới để xem nhanh tồn kho và tính giá in
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2.5">
          {/* Low stock pill tags */}
          {stats.lowStockModels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-0.5">
                Cần in thêm ({stats.lowStockModels.length}):
              </span>
              {stats.lowStockModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSearch(m.name);
                    setStockFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs rounded-md border border-amber-500/30 bg-card px-2.5 py-1 text-foreground hover:bg-amber-500/10 hover:border-amber-500/50 transition-colors shadow-2xs"
                  title={`Bấm để xem mẫu ${m.name}`}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="font-bold text-amber-600">({m.totalAvailable} cái)</span>
                </button>
              ))}
            </div>
          )}

          {/* Out of stock pill tags */}
          {stats.outOfStockModels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-500/10 border border-rose-500/30 rounded-md px-2 py-0.5">
                Hết sạch ({stats.outOfStockModels.length}):
              </span>
              {stats.outOfStockModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSearch(m.name);
                    setStockFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs rounded-md border border-rose-500/30 bg-card px-2.5 py-1 text-foreground hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors shadow-2xs"
                  title={`Bấm để xem mẫu ${m.name}`}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="font-bold text-rose-600">(0 cái)</span>
                </button>
              ))}
            </div>
          )}

          {/* In stock summary if all good */}
          {stats.lowStockModels.length === 0 && stats.outOfStockModels.length === 0 && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              ✨ Tuyệt vời! Tất cả các mẫu sản phẩm ({stats.inStockModels.slice(0, 3).map((m) => m.name).join(', ')}...) đều đang đủ tồn kho sẵn sàng giao ngay.
            </p>
          )}

          {(search || stockFilter !== 'ALL' || categoryFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 size-3" />
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên mẫu (VD: Zoro, Luffy...) hoặc mã SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap text-muted-foreground">Danh mục:</Label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Type Dropdown */}
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap text-muted-foreground">Loại hàng:</Label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Tất cả loại hàng</option>
                <option value="READY_STOCK">Hàng có sẵn kho (READY_STOCK)</option>
                <option value="MADE_TO_ORDER">In theo yêu cầu (MADE_TO_ORDER)</option>
              </select>
            </div>
          </div>

          {/* Stock Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="flex items-center text-xs font-semibold text-muted-foreground mr-1">
              <Filter className="mr-1.5 size-3.5" />
              Lọc theo tình trạng:
            </span>
            <Button
              size="sm"
              variant={stockFilter === 'ALL' ? 'default' : 'outline'}
              className="h-7 text-xs font-medium"
              onClick={() => setStockFilter('ALL')}
            >
              Tất cả ({products.length} mẫu)
            </Button>
            <Button
              size="sm"
              variant={stockFilter === 'IN_STOCK' ? 'default' : 'outline'}
              className="h-7 text-xs font-medium"
              onClick={() => setStockFilter('IN_STOCK')}
            >
              🟢 Đang đủ hàng ({stats.inStockModels.length})
            </Button>
            <Button
              size="sm"
              variant={stockFilter === 'LOW_STOCK' ? 'default' : 'outline'}
              className="h-7 text-xs font-medium"
              onClick={() => setStockFilter('LOW_STOCK')}
            >
              🟡 Gần hết hàng ({stats.lowStockModels.length})
            </Button>
            <Button
              size="sm"
              variant={stockFilter === 'OUT_OF_STOCK' ? 'default' : 'outline'}
              className="h-7 text-xs font-medium"
              onClick={() => setStockFilter('OUT_OF_STOCK')}
            >
              🔴 Đã hết hàng ({stats.outOfStockModels.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main List of Models */}
      <div className="flex flex-col gap-4">
        {filteredProducts.length === 0 ? (
          <Card className="border-border/70 shadow-xs">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Warehouse className="size-12 mb-3 stroke-1 text-muted-foreground/50" />
              <p className="font-semibold text-base text-foreground">Không tìm thấy mẫu sản phẩm nào phù hợp</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Thử thay đổi từ khóa tìm kiếm hoặc chọn &quot;Tất cả mẫu&quot; để hiển thị lại danh sách.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="mt-4 text-xs"
              >
                Xóa bộ lọc
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredProducts.map((product) => {
            const isExpanded = expandedProducts[product.id] !== false; // expanded by default
            const productTargetKey = `p-${product.id}`;
            const isEditingProductPrice = editingPriceTarget === productTargetKey;
            const isSavingProductPrice = savingTarget === productTargetKey;
            const isSuccessProductPrice = saveSuccessTarget === productTargetKey;

            return (
              <Card key={product.id} className="overflow-hidden border border-border/80 shadow-xs transition-shadow hover:shadow-sm">
                {/* Product Model Header Row */}
                <div className="flex flex-col gap-3 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(product.id)}
                      className="mt-0.5 rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={isExpanded ? 'Thu gọn phân loại' : 'Mở rộng phân loại'}
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-base text-foreground tracking-tight">
                          {product.name}
                        </span>

                        {/* Model Level Stock Badge */}
                        {product.totalAvailable > 5 ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                            🟢 Có sẵn {product.totalAvailable} cái
                          </Badge>
                        ) : product.totalAvailable > 0 ? (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                            🟡 Gần hết: còn {product.totalAvailable} cái
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold text-xs">
                            🔴 Hết hàng (0 cái)
                          </Badge>
                        )}

                        {product.categoryName && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {product.categoryName}
                          </Badge>
                        )}
                        <Badge
                          variant={product.productType === 'READY_STOCK' ? 'outline' : 'secondary'}
                          className="text-[11px]"
                        >
                          {product.productType === 'READY_STOCK' ? 'Hàng sẵn' : 'Đặt in'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Slug: <code>{product.slug}</code></span>
                        <span>•</span>
                        <span>{product.variants.length} phân loại / biến thể</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock & Price Summary on Header */}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {/* Stock Detail Pill */}
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border/80 text-xs">
                      <span className="text-muted-foreground">Tồn kho mẫu:</span>
                      <span className="font-semibold text-foreground">
                        {product.totalOnHand} thực tồn
                      </span>
                      {product.totalReserved > 0 && (
                        <span className="text-amber-600 font-medium">
                          ({product.totalReserved} đang giữ)
                        </span>
                      )}
                      <span className="text-muted-foreground">→</span>
                      <span className={`font-bold ${product.totalAvailable > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {product.totalAvailable} khả dụng
                      </span>
                    </div>

                    {/* Base Price & Quick Edit */}
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border/80">
                      <span className="text-xs text-muted-foreground">Giá cơ bản:</span>
                      {isEditingProductPrice ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={inlinePriceValue}
                            onChange={(e) => setInlinePriceValue(e.target.value)}
                            className="h-7 w-28 text-xs font-semibold"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlinePrice(product.id);
                              if (e.key === 'Escape') handleCancelInlineEdit();
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={isSavingProductPrice || isPending}
                            onClick={() => handleSaveInlinePrice(product.id)}
                          >
                            {isSavingProductPrice ? <Loader2 className="size-3 animate-spin" /> : 'Lưu'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-xs"
                            onClick={handleCancelInlineEdit}
                          >
                            Hủy
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary">
                            {formatVnd(product.basePrice)}
                          </span>
                          {isSuccessProductPrice && (
                            <span className="flex items-center text-xs text-emerald-600 font-medium">
                              <Check className="size-3 mr-0.5" /> Đã lưu
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleStartInlineEdit(productTargetKey, product.basePrice)}
                          >
                            Sửa giá
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-medium"
                        onClick={() => openCalculator({
                          productId: product.id,
                          productName: product.name,
                          currentPrice: product.basePrice,
                        })}
                      >
                        <Calculator className="mr-1 size-3.5 text-primary" />
                        Tính giá in 3D
                      </Button>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 px-2 text-xs' })}
                        title="Xem toàn bộ cấu hình sản phẩm"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Variants / Options Breakdown Table */}
                {isExpanded && (
                  <div className="p-0">
                    {product.variants.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground bg-muted/10">
                        Mẫu này chưa có phân loại phiên bản. Giá bán sẽ áp dụng theo Giá cơ bản.
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="ml-2 font-medium text-primary hover:underline"
                        >
                          + Thêm phiên bản tại trang chi tiết
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/70">
                            <tr>
                              <th className="py-2.5 px-4 font-semibold">Mã SKU</th>
                              <th className="py-2.5 px-4 font-semibold">Phân loại / Phiên bản</th>
                              <th className="py-2.5 px-4 font-semibold text-center">Tình trạng tồn</th>
                              <th className="py-2.5 px-4 font-semibold text-right">Thực tồn</th>
                              <th className="py-2.5 px-4 font-semibold text-right">Đã giữ</th>
                              <th className="py-2.5 px-4 font-semibold text-right">Khả dụng</th>
                              <th className="py-2.5 px-4 font-semibold text-right">Giá bán (VND)</th>
                              <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {product.variants.map((variant) => {
                              const variantTargetKey = `v-${variant.id}`;
                              const isEditingVariantPrice = editingPriceTarget === variantTargetKey;
                              const isSavingVariantPrice = savingTarget === variantTargetKey;
                              const isSuccessVariantPrice = saveSuccessTarget === variantTargetKey;
                              const stockStatus = getVariantStockStatus(variant.available);

                              return (
                                <tr key={variant.id} className="hover:bg-muted/15 transition-colors">
                                  {/* SKU */}
                                  <td className="py-2.5 px-4 font-mono text-xs font-semibold text-foreground">
                                    {variant.sku}
                                  </td>

                                  {/* Name */}
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground">{variant.name}</span>
                                      {!variant.isActive && (
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                          Tạm ngừng bán
                                        </Badge>
                                      )}
                                      {variant.weightGrams ? (
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                          ({variant.weightGrams}g)
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>

                                  {/* Stock Status Badge */}
                                  <td className="py-2.5 px-4 text-center">
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stockStatus.badgeClass}`}>
                                      {stockStatus.label}
                                    </span>
                                  </td>

                                  {/* On Hand */}
                                  <td className="py-2.5 px-4 text-right font-medium text-muted-foreground tabular-nums">
                                    {variant.onHand} cái
                                  </td>

                                  {/* Reserved */}
                                  <td className="py-2.5 px-4 text-right font-medium text-amber-600 tabular-nums">
                                    {variant.reserved > 0 ? `${variant.reserved} cái` : '—'}
                                  </td>

                                  {/* Available */}
                                  <td className="py-2.5 px-4 text-right tabular-nums">
                                    <span className={`font-bold text-sm ${variant.available > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {variant.available} cái
                                    </span>
                                  </td>

                                  {/* Price with Inline Edit */}
                                  <td className="py-2.5 px-4 text-right tabular-nums">
                                    {isEditingVariantPrice ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Input
                                          type="number"
                                          min={0}
                                          value={inlinePriceValue}
                                          onChange={(e) => setInlinePriceValue(e.target.value)}
                                          className="h-7 w-28 text-xs font-semibold text-right"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveInlinePrice(product.id, variant.id);
                                            if (e.key === 'Escape') handleCancelInlineEdit();
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                          disabled={isSavingVariantPrice || isPending}
                                          onClick={() => handleSaveInlinePrice(product.id, variant.id)}
                                        >
                                          {isSavingVariantPrice ? <Loader2 className="size-3 animate-spin" /> : 'Lưu'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-1.5 text-xs"
                                          onClick={handleCancelInlineEdit}
                                        >
                                          ✕
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-2">
                                        {isSuccessVariantPrice && (
                                          <span className="flex items-center text-xs text-emerald-600 font-medium">
                                            <Check className="size-3 mr-0.5" /> Đã lưu
                                          </span>
                                        )}
                                        <span className="font-semibold text-primary">
                                          {formatVnd(variant.price)}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                          onClick={() => handleStartInlineEdit(variantTargetKey, variant.price)}
                                        >
                                          Sửa
                                        </Button>
                                      </div>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-2.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs font-medium"
                                        onClick={() => openCalculator({
                                          productId: product.id,
                                          productName: product.name,
                                          variantId: variant.id,
                                          variantSku: variant.sku,
                                          currentPrice: variant.price,
                                          weightGrams: variant.weightGrams,
                                        })}
                                      >
                                        <Calculator className="mr-1 size-3 text-primary" />
                                        Tính giá
                                      </Button>
                                      <Link
                                        href={`/admin/inventory`}
                                        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-7 px-2 text-xs text-muted-foreground hover:text-foreground' })}
                                        title="Chuyển đến sổ kho để nhập / xuất tồn kho"
                                      >
                                        <Boxes className="size-3.5 mr-1" />
                                        Nhập/Xuất
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

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
                    value={calcMaterialId}
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
