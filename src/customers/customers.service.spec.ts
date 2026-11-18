import { BadRequestException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import type { PrismaService } from '../database/prisma.service';

describe('CustomersService', () => {
  const customer = {
    id: 'cust-1',
    name: 'New Customer',
    gstin: null,
    phone: '555-1234',
    email: 'new@example.com',
    address: '1 Main Street',
    stateCode: '27',
  };
  let prisma: {
    customer: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };
  let service: CustomersService;

  beforeEach(() => {
    prisma = {
      customer: {
        count: jest.fn().mockResolvedValue(43),
        findMany: jest.fn().mockResolvedValue([{ ...customer, _count: { invoices: 3 } }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(customer),
      },
    };
    service = new CustomersService(prisma as unknown as PrismaService);
  });

  it('uses database count and offset pagination for customer lists', async () => {
    const result = await service.search({
      page: 2,
      limit: 10,
      search: 'north',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(prisma.customer.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: expect.any(String) }),
    }));
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      include: { _count: { select: { invoices: true } } },
    }));
    expect(result).toMatchObject({
      data: [{ id: 'cust-1', invoiceCount: 3 }],
      pagination: { currentPage: 2, pageSize: 10, totalRecords: 43, totalPages: 5 },
    });
  });

  it('creates a normalized customer in the database', async () => {
    const created = await service.create({
      name: '  New Customer ',
      phone: ' 555-1234 ',
      email: ' new@example.com ',
      address: ' 1 Main Street ',
      stateCode: ' 27 ',
      gstin: ' ',
    });
    expect(created).toMatchObject({
      name: 'New Customer',
      phone: '555-1234',
      email: 'new@example.com',
      address: '1 Main Street',
      stateCode: '27',
    });
    expect(prisma.customer.create).toHaveBeenCalled();
  });

  it('requires customer name, phone, address, and state code', async () => {
    await expect(service.create({
      name: '',
      phone: '',
      email: '',
      address: '',
      stateCode: '',
    })).rejects.toThrow(BadRequestException);
  });
});
