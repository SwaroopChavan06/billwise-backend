import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { paginationMetadata, type PaginatedResult, type PaginationQuery } from '../common/pagination.js';
import { DEFAULT_BRANCH_ID, PrismaService } from '../database/prisma.service.js';

export interface Product {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  unit: string;
  gstRate: number;
  sellingPrice: number;
  quantityAvailable: number;
}

export interface ProductInput {
  name: string;
  sku: string;
  hsnCode: string;
  unit: string;
  gstRate: number;
  sellingPrice: number;
  quantityAvailable: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: PaginationQuery): Promise<PaginatedResult<Product>> {
    const where: Prisma.ProductWhereInput = {
      branchId: DEFAULT_BRANCH_ID,
      deletedAt: null,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
          { hsnCode: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const totalRecords = await this.prisma.product.count({ where });
    const pagination = paginationMetadata(query.page, query.limit, totalRecords);
    const data = await this.prisma.product.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (pagination.currentPage - 1) * query.limit,
      take: query.limit,
    });
    return { data: data.map((product) => this.toProduct(product)), pagination };
  }

  async create(input: ProductInput): Promise<Product> {
    const product = this.validate(input);
    try {
      const created = await this.prisma.product.create({
        data: { ...product, id: `prod-${randomUUID()}`, branchId: DEFAULT_BRANCH_ID },
      });
      return this.toProduct(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A product with this SKU already exists');
      }
      throw error;
    }
  }

  async update(id: string, input: ProductInput): Promise<Product> {
    const product = this.validate(input);
    const existing = await this.prisma.product.findFirst({
      where: { id, branchId: DEFAULT_BRANCH_ID, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Product ${id} was not found`);
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: product,
      });
      return this.toProduct(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A product with this SKU already exists');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Product | undefined> {
    const product = await this.prisma.product.findFirst({
      where: { id, branchId: DEFAULT_BRANCH_ID, deletedAt: null },
    });
    return product ? this.toProduct(product) : undefined;
  }

  private validate(input: ProductInput): Omit<Product, 'id'> {
    if (
      !input ||
      typeof input.name !== 'string' || !input.name.trim() ||
      typeof input.sku !== 'string' || !input.sku.trim() ||
      typeof input.hsnCode !== 'string' || !input.hsnCode.trim() ||
      typeof input.unit !== 'string' || !input.unit.trim() ||
      !Number.isFinite(input.gstRate) || input.gstRate < 0 ||
      !Number.isFinite(input.sellingPrice) || input.sellingPrice < 0 ||
      !Number.isInteger(input.quantityAvailable) || input.quantityAvailable < 0
    ) {
      throw new BadRequestException('Product name, SKU, HSN, unit, and valid price, GST rate, and whole-number quantity are required');
    }
    return {
      name: input.name.trim(),
      sku: input.sku.trim(),
      hsnCode: input.hsnCode.trim(),
      unit: input.unit.trim(),
      gstRate: input.gstRate,
      sellingPrice: input.sellingPrice,
      quantityAvailable: input.quantityAvailable,
    };
  }

  private toProduct(product: {
    id: string;
    name: string;
    sku: string;
    hsnCode: string;
    unit: string;
    gstRate: Prisma.Decimal;
    sellingPrice: Prisma.Decimal;
    quantityAvailable: number;
  }): Product {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      hsnCode: product.hsnCode,
      unit: product.unit,
      gstRate: product.gstRate.toNumber(),
      sellingPrice: product.sellingPrice.toNumber(),
      quantityAvailable: product.quantityAvailable,
    };
  }
}
