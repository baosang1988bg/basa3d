import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

test('listProductInventory aggregates stock levels and pricing accurately', async () => {
  const mockRows = [
    {
      id: 'prod-1',
      name: 'Khay chia ngăn',
      slug: 'khay-chia-ngan',
      status: 'ACTIVE',
      productType: 'READY_STOCK',
      basePrice: '120000',
      costPrice: '60000',
      categoryId: 'cat-1',
      pricingConfigId: 'cfg-1',
      categoryName: 'Gia dụng',
      variants: [
        {
          id: 'var-1',
          sku: 'KHAY-DEN',
          name: 'Màu đen',
          price: '120000',
          costPrice: '60000',
          weightGrams: 80,
          isActive: true,
          onHand: 10,
          reserved: 2,
          available: 8,
        },
        {
          id: 'var-2',
          sku: 'KHAY-TRANG',
          name: 'Màu trắng',
          price: '130000',
          costPrice: '65000',
          weightGrams: 80,
          isActive: true,
          onHand: 3,
          reserved: 0,
          available: 3,
        },
      ],
    },
    {
      id: 'prod-2',
      name: 'Móc khoá in 3D',
      slug: 'moc-khoa-in-3d',
      status: 'ACTIVE',
      productType: 'READY_STOCK',
      basePrice: '45000',
      costPrice: '15000',
      categoryId: 'cat-2',
      pricingConfigId: null,
      categoryName: 'Phụ kiện',
      variants: [
        {
          id: 'var-3',
          sku: 'MK-01',
          name: 'Tiêu chuẩn',
          price: '45000',
          costPrice: '15000',
          weightGrams: 15,
          isActive: true,
          onHand: 0,
          reserved: 0,
          available: 0,
        },
      ],
    },
  ];

  const db = mock.module('../src/lib/db.ts', {
    namedExports: {
      query: async () => ({ rows: mockRows }),
      withTransaction: () => { throw new Error('Query must not write'); },
    },
  });

  try {
    const { listProductInventory } = await import('../src/services/product.service');

    // Test list all
    const all = await listProductInventory();
    assert.equal(all.length, 2);
    assert.equal(all[0].totalOnHand, 13);
    assert.equal(all[0].totalReserved, 2);
    assert.equal(all[0].totalAvailable, 11);
    assert.equal(all[0].variants.length, 2);
    assert.equal(all[0].basePrice, 120000);

    // Test filter IN_STOCK (available > 0)
    const inStock = await listProductInventory({ stockFilter: 'IN_STOCK' });
    assert.equal(inStock.length, 1);
    assert.equal(inStock[0].id, 'prod-1');

    // Test filter OUT_OF_STOCK (available <= 0)
    const outOfStock = await listProductInventory({ stockFilter: 'OUT_OF_STOCK' });
    assert.equal(outOfStock.length, 1);
    assert.equal(outOfStock[0].id, 'prod-2');
  } finally {
    db.restore();
  }
});
