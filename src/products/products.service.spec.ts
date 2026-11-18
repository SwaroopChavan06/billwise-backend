import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import type { PrismaService } from '../database/prisma.service';

describe('ProductsService', () => {
  const storedProduct = {
    id: 'prod-1',
    name: 'Custom folders',
    sku: 'CF-001',
    hsnCode: '4820',
    unit: 'piece',
    gstRate: new Prisma.Decimal(18),
    sellingPrice: new Prisma.Decimal(25),
    quantityAvailable: 4,
  };
  let prisma: {
    product: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: {
        count: jest.fn().mockResolvedValue(43),
        findMany: jest.fn().mockResolvedValue([storedProduct]),
        findFirst: jest.fn().mockResolvedValue(storedProduct),
        create: jest.fn().mockResolvedValue(storedProduct),
        update: jest.fn().mockResolvedValue(storedProduct),
      },
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  const newProduct = {
    name: 'Custom folders',
    sku: 'CF-001',
    hsnCode: '4820',
    unit: 'piece',
    gstRate: 18,
    sellingPrice: 25,
    quantityAvailable: 4,
  };

  it('uses database count and offset pagination for product lists', async () => {
    const result = await service.search({
      page: 2,
      limit: 10,
      search: 'folders',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      orderBy: { name: 'asc' },
    }));
    expect(result).toMatchObject({
      data: [{ id: 'prod-1', quantityAvailable: 4, sellingPrice: 25 }],
      pagination: { currentPage: 2, pageSize: 10, totalRecords: 43, totalPages: 5 },
    });
  });

  it('creates a product with the supplied price and inventory quantity', async () => {
    const product = await service.create(newProduct);
    expect(product).toMatchObject({ name: newProduct.name, quantityAvailable: 4 });
    expect(prisma.product.create).toHaveBeenCalled();
  });

  it('updates an existing product', async () => {
    const updated = await service.update('prod-1', { ...newProduct, sellingPrice: 2900, quantityAvailable: 3 });
    expect(updated).toMatchObject({ id: 'prod-1', sellingPrice: 25, quantityAvailable: 4 });
    expect(prisma.product.update).toHaveBeenCalled();
  });

  it('rejects fractional inventory quantities', async () => {
    await expect(service.create({ ...newProduct, quantityAvailable: 4.5 }))
      .rejects.toThrow(BadRequestException);
  });

  it('reports a missing product when updating', async () => {
    prisma.product.findFirst.mockResolvedValueOnce(null);
    await expect(service.update('unknown', newProduct)).rejects.toThrow(NotFoundException);
  });
});
