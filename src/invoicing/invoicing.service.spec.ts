import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersService } from '../customers/customers.service';
import type { Customer } from '../customers/customers.service';
import type { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import type { Product } from '../products/products.service';
import { InvoicingService } from './invoicing.service';

describe('InvoicingService', () => {
  let service: InvoicingService;
  let prisma: {
    invoice: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    numberSeries: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let productsService: { findById: jest.Mock };
  let customersService: { findById: jest.Mock };

  const customers: Customer[] = [
    { id: 'cust-1', name: 'Apex Architects', phone: '+91 98765 43210', email: 'accounts@apex.example', address: 'Mumbai', stateCode: '27' },
    { id: 'cust-2', name: 'Greenfield Events', phone: '+91 98200 11223', email: 'billing@greenfield.example', address: 'Mumbai', stateCode: '27' },
    { id: 'cust-3', name: 'Northstar Retail', phone: '+91 98100 44556', email: 'finance@northstar.example', address: 'Bengaluru', stateCode: '29' },
  ];
  const products: Product[] = [
    { id: 'prod-business-cards', name: 'Business cards', sku: 'BC-001', hsnCode: '4911', unit: 'box', gstRate: 18, sellingPrice: 1000, quantityAvailable: 42 },
    { id: 'prod-matte-paper', name: 'Premium matte paper', sku: 'PMP-001', hsnCode: '4802', unit: 'sheet', gstRate: 18, sellingPrice: 12, quantityAvailable: 12 },
  ];

  beforeEach(() => {
    let nextNumber = 0;
    const transaction = {
      numberSeries: {
        upsert: jest.fn().mockImplementation(async () => ({ nextNumber: ++nextNumber })),
      },
      invoice: {
        create: jest.fn().mockImplementation(async ({ data }) => makeDatabaseInvoice(data)),
        update: jest.fn(),
      },
    };
    prisma = {
      invoice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => makeDatabaseInvoice(data)),
        update: jest.fn(),
      },
      numberSeries: transaction.numberSeries,
      $transaction: jest.fn().mockImplementation((callback) => callback(transaction)),
    };
    productsService = {
      findById: jest.fn((id: string) => Promise.resolve(products.find((product) => product.id === id))),
    };
    customersService = {
      findById: jest.fn(async (id: string) => {
        const customer = customers.find((item) => item.id === id);
        if (!customer) throw new Error('Customer not found');
        return customer;
      }),
    };
    service = new InvoicingService(
      prisma as unknown as PrismaService,
      productsService as unknown as ProductsService,
      customersService as unknown as CustomersService,
    );
  });

  function makeDraft(id: string, customerId = 'cust-1') {
    return {
      id,
      customerId,
      customerName: 'Ignored client value',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [
        { productId: 'prod-business-cards', description: 'Ignored', hsnCode: '0', unit: '0', quantity: 2, rate: 1000, gstRate: 0 },
      ],
    };
  }

  it('creates an invoice with catalog details, customer snapshot, and calculated taxes', async () => {
    const invoice = await service.create(makeDraft('invoice-test-1', 'cust-3'));

    expect(invoice.status).toBe('ISSUED');
    expect(invoice.invoiceNumber).toBe('INV260001');
    expect(invoice.customerName).toBe('Northstar Retail');
    expect(invoice.customerPhone).toBe('+91 98100 44556');
    expect(invoice.lines[0]).toMatchObject({
      description: 'Business cards',
      hsnCode: '4911',
      unit: 'box',
      rate: 1000,
      gstRate: 18,
    });
    expect(invoice.subtotal).toBe(2000);
    expect(invoice.igst).toBe(360);
    expect(invoice.total).toBe(2360);
  });

  it('rejects invoice items without an existing catalog product', async () => {
    const unlinkedDraft = makeDraft('invoice-unlinked-product');
    unlinkedDraft.lines[0].productId = '';
    await expect(service.create(unlinkedDraft)).rejects.toThrow('Every invoice item must be selected from the product catalogue');

    productsService.findById.mockResolvedValueOnce(undefined);
    await expect(service.create(makeDraft('invoice-missing-product'))).rejects.toThrow('Product prod-business-cards was not found');
  });

  it('calculates same-state GST and line totals for multiple products', async () => {
    const draft = makeDraft('invoice-test-2');
    draft.lines = [
      { productId: 'prod-business-cards', description: '', hsnCode: '', unit: '', quantity: 1, rate: 1000, gstRate: 0 },
      { productId: 'prod-matte-paper', description: '', hsnCode: '', unit: '', quantity: 10, rate: 12, gstRate: 0 },
    ];
    const invoice = await service.create(draft);

    expect(invoice.lines).toHaveLength(2);
    expect(invoice.cgst).toBe(100.8);
    expect(invoice.sgst).toBe(100.8);
    expect(invoice.total).toBe(1322);
    expect(invoice.lines[1].total).toBe(141.6);
    expect(invoice.roundOff).toBe(0.4);
  });

  it('rejects invoices with more than 15 items', async () => {
    await expect(service.create({
      ...makeDraft('invoice-too-many-lines'),
      lines: Array.from({ length: 16 }, () => ({
        productId: 'prod-business-cards',
        description: '',
        hsnCode: '',
        unit: '',
        quantity: 1,
        rate: 0,
        gstRate: 0,
      })),
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects fractional quantities and discounts', async () => {
    const draft = makeDraft('invoice-fractional-quantity');
    draft.lines[0].quantity = 1.5;
    await expect(service.create(draft)).rejects.toThrow(BadRequestException);

    const discountDraft = makeDraft('invoice-fractional-discount');
    discountDraft.lines[0].discount = 1.5;
    await expect(service.create(discountDraft)).rejects.toThrow(BadRequestException);
  });

  it('rounds the aggregated invoice total to a whole rupee', async () => {
    const draft = makeDraft('invoice-whole-total');
    draft.lines = [{
      productId: 'prod-matte-paper',
      description: '',
      hsnCode: '',
      unit: '',
      quantity: 1,
      rate: 12,
      gstRate: 0,
    }];
    const invoice = await service.create(draft);
    expect(invoice.total).toBe(14);
    expect(invoice.roundOff).toBe(-0.16);
  });

  it('uses database count and offset pagination for invoice lists', async () => {
    prisma.invoice.count.mockResolvedValue(43);
    prisma.invoice.findMany.mockResolvedValue([]);

    const result = await service.listIssued({
      page: 3,
      limit: 20,
      search: 'INV',
      sortBy: 'issueDate',
      sortOrder: 'desc',
    }, 'cust-1');

    expect(prisma.invoice.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: expect.any(String), customerId: 'cust-1' }),
    }));
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 40,
      take: 20,
      select: expect.not.objectContaining({ items: true }),
    }));
    expect(result.pagination).toEqual({
      currentPage: 3,
      pageSize: 20,
      totalRecords: 43,
      totalPages: 3,
    });
  });
});

function makeDatabaseInvoice(data: Record<string, any>) {
  const customerId = data.customer.connect.id as string;
  const customer = [
    { id: 'cust-1', name: 'Apex Architects', phone: '+91 98765 43210', email: 'accounts@apex.example', address: 'Mumbai', stateCode: '27', gstin: null },
    { id: 'cust-2', name: 'Greenfield Events', phone: '+91 98200 11223', email: 'billing@greenfield.example', address: 'Mumbai', stateCode: '27', gstin: null },
    { id: 'cust-3', name: 'Northstar Retail', phone: '+91 98100 44556', email: 'finance@northstar.example', address: 'Bengaluru', stateCode: '29', gstin: null },
  ].find((item) => item.id === customerId)!;
  const decimal = (value: number | undefined) => new Prisma.Decimal(value ?? 0);
  return {
    id: data.id,
    customerId,
    customer,
    customerSnapshot: data.customerSnapshot,
    includeDateTime: data.includeDateTime,
    customerStateCode: data.customerStateCode,
    branchStateCode: data.branchStateCode,
    status: data.status,
    invoiceNumber: data.invoiceNumber,
    issueDate: data.issueDate,
    createdAt: new Date('2026-11-14T00:00:00.000Z'),
    subtotal: decimal(data.subtotal),
    taxableValue: decimal(data.taxableValue),
    cgst: decimal(data.cgst),
    sgst: decimal(data.sgst),
    igst: decimal(data.igst),
    roundOff: decimal(data.roundOff),
    total: decimal(data.total),
    amountInWords: data.amountInWords,
    items: data.items.create.map((line: Record<string, any>, index: number) => ({
      id: `item-${index}`,
      lineNumber: line.lineNumber,
      productId: line.product?.connect.id ?? null,
      description: line.description,
      hsnCode: line.hsnCode,
      unit: line.unit,
      quantity: line.quantity,
      rate: decimal(line.rate),
      discount: decimal(line.discount),
      taxableValue: decimal(line.taxableValue),
      gstRate: decimal(line.gstRate),
      cgst: decimal(line.cgst),
      sgst: decimal(line.sgst),
      igst: decimal(line.igst),
      total: decimal(line.total),
    })),
  };
}
