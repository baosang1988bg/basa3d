import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { ProductOnboardingForm } from '@/components/admin/product-onboarding-form';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getCategoryDisplayName } from '@/lib/categories';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { getProductOnboardingOptions, UNCATEGORIZED_SLUG } from '@/services/product-onboarding.service';

export const metadata = { title: 'Đăng sản phẩm mới | BaSa3D Admin' };

// Phase 52 P2 (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
export default async function NewProductPage() {
  await requireAdmin();
  const [options, materials, pricingConfig] = await Promise.all([
    getProductOnboardingOptions(), listMaterials(), getCurrentPricingConfig(),
  ]);
  const categories = options.categories
    .filter((category) => category.slug !== UNCATEGORIZED_SLUG)
    .map((category) => ({ id: category.id, label: getCategoryDisplayName(category, 'vi') }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/products" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-fit -ml-2' })}>
          <ArrowLeft className="mr-1 size-4" /> Danh sách sản phẩm
        </Link>
        <h1 className="text-2xl font-semibold">Đăng sản phẩm mới</h1>
        <p className="text-sm text-muted-foreground">Ảnh → thông tin → cách bán. Đường dẫn (slug) và mã SKU do hệ thống tự tạo.</p>
      </div>
      <ProductOnboardingForm
        categories={categories}
        colors={options.colors}
        warehouses={options.warehouses}
        materials={materials}
        pricingConfig={pricingConfig}
      />
    </div>
  );
}
