import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DEFAULT_BRANCH_ID, PrismaService } from '../database/prisma.service.js';
import { paginationMetadata, type PaginatedResult, type PaginationQuery } from '../common/pagination.js';

export interface Customer {
  id: string;
  name: string;
  gstin?: string;
  phone: string;
  email: string;
  address: string;
  stateCode: string;
  invoiceCount?: number;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: PaginationQuery): Promise<PaginatedResult<Customer>> {
    const where: Prisma.CustomerWhereInput = {
      branchId: DEFAULT_BRANCH_ID,
      deletedAt: null,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const totalRecords = await this.prisma.customer.count({ where });
    const pagination = paginationMetadata(query.page, query.limit, totalRecords);
    const data = await this.prisma.customer.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (pagination.currentPage - 1) * query.limit,
      take: query.limit,
      include: { _count: { select: { invoices: true } } },
    });
    return {
      data: data.map((customer) => ({
        id: customer.id,
        name: customer.name,
        gstin: customer.gstin ?? undefined,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address,
        stateCode: customer.stateCode,
        invoiceCount: customer._count.invoices,
      })),
      pagination,
    };
  }

  async create(customer: Omit<Customer, 'id' | 'invoiceCount'>): Promise<Customer> {
    if (!customer.name?.trim() || !customer.phone?.trim() || !customer.address?.trim() || !customer.stateCode?.trim()) {
      throw new BadRequestException('Customer name, phone, address, and state code are required');
    }
    const phone = customer.phone.trim();
    const duplicatePhone = await this.prisma.customer.findFirst({
      where: { branchId: DEFAULT_BRANCH_ID, phone, deletedAt: null },
      select: { id: true },
    });
    if (duplicatePhone) throw new BadRequestException('A customer with this phone number already exists');

    try {
      const createdCustomer = await this.prisma.customer.create({
        data: {
          id: `cust-${randomUUID()}`,
          branchId: DEFAULT_BRANCH_ID,
          name: customer.name.trim(),
          phone,
          email: customer.email?.trim() || null,
          address: customer.address.trim(),
          stateCode: customer.stateCode.trim(),
          gstin: customer.gstin?.trim() || null,
        },
      });
      return this.toCustomer(createdCustomer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A customer with this phone number already exists');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId: DEFAULT_BRANCH_ID, deletedAt: null },
    });
    if (!customer) throw new NotFoundException(`Customer ${id} was not found`);
    return this.toCustomer(customer);
  }

  private toCustomer(customer: {
    id: string;
    name: string;
    gstin: string | null;
    phone: string | null;
    email: string | null;
    address: string;
    stateCode: string;
  }): Customer {
    return {
      id: customer.id,
      name: customer.name,
      gstin: customer.gstin ?? undefined,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address,
      stateCode: customer.stateCode,
    };
  }
}
