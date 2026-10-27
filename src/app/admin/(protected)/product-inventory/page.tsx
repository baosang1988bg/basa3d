import { getCategoryDisplayName } from '@/lib/categories';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listCategories, listProductInventory } from '@/services/product.service';
import { listMaterials, listWarehouses } from '@/services/inventory.service';
import { listStockTrackedVariants } from '@/services/quick-restock.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { ProductInventoryManager } from '@/components/admin/product-inventory-manager';

export const metadata = {
  title: 'Kho sản phẩm & Cấu hình giá | BaSa3D Admin',
};

export default async function ProductInventoryPage() {
  await requireAdmin();

  const [products, { items: categories }, materials, pricingConfig, batchVariants, warehouses] = await Promise.all([
    listProductInventory(),
    listCategories({ limit: 100 }),
    listMaterials(),
    getCurrentPricingConfig(),
    listStockTrackedVariants(),
    listWarehouses(),
  ]);

  return (
    <ProductInventoryManager
      products={products}
      categories={categories.map((c) => ({ ...c, name: getCategoryDisplayName(c, 'vi') }))}
      materials={materials}
      pricingConfig={pricingConfig}
      batchVariants={batchVariants}
      warehouses={warehouses}
    />
  );
}
