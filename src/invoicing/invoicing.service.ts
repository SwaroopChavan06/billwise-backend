import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { amountInWords, roundMoney } from '../common/money.js';
import { paginationMetadata, type PaginatedResult, type PaginationQuery } from '../common/pagination.js';
import { DEFAULT_BRANCH_ID, PrismaService } from '../database/prisma.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { ProductsService } from '../products/products.service.js';
import { calculateGst, financialYear } from './gst-calculator.js';

export interface InvoiceDraftLine {
  productId?: string;
  description: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  rate: number;
  discount?: number;
  gstRate: number;
}

export interface InvoiceDraft {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  includeDateTime?: boolean;
  customerStateCode: string;
  branchStateCode: string;
  lines: InvoiceDraftLine[];
}

export interface CalculatedInvoiceLine extends InvoiceDraftLine {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface IssuedInvoice extends Omit<InvoiceDraft, 'lines'> {
  lines: CalculatedInvoiceLine[];
  status: 'DRAFT' | 'ISSUED';
  invoiceNumber: string;
  issueDate: string;
  subtotal: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
  amountInWords: string;
}

export type InvoiceListItem = Pick<
  IssuedInvoice,
  'id' | 'customerId' | 'customerName' | 'invoiceNumber' | 'issueDate' |
  'subtotal' | 'cgst' | 'sgst' | 'igst' | 'roundOff' | 'total' | 'status'
>;

const invoiceWithItems = Prisma.validator<Prisma.InvoiceInclude>()({
  customer: true,
  items: { orderBy: { lineNumber: 'asc' } },
});
type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: typeof invoiceWithItems }>;

@Injectable()
export class InvoicingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly customersService: CustomersService,
  ) {}

  async createDraft(draft: InvoiceDraft): Promise<IssuedInvoice> {
    const calculated = await this.calculateInvoice(draft, 'DRAFT', new Date(), 'DRAFT');
    const exists = await this.prisma.invoice.findUnique({ where: { id: calculated.id }, select: { id: true } });
    if (exists) throw new BadRequestException(`Invoice ${calculated.id} already exists`);
    const created = await this.prisma.invoice.create({
      data: this.toCreateInput(calculated, null, null),
      include: invoiceWithItems,
    });
    return this.toIssuedInvoice(created);
  }

  async create(draft: InvoiceDraft, issueDate = new Date()): Promise<IssuedInvoice> {
    const calculated = await this.calculateInvoice(draft, 'ISSUED', issueDate, '');
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const series = await transaction.numberSeries.upsert({
          where: { branchId_financialYear: { branchId: DEFAULT_BRANCH_ID, financialYear: financialYear(issueDate) } },
          create: { branchId: DEFAULT_BRANCH_ID, financialYear: financialYear(issueDate), nextNumber: 1 },
          update: { nextNumber: { increment: 1 } },
        });
        const invoiceNumber = `INV${financialYear(issueDate).slice(0, 2)}${String(series.nextNumber).padStart(4, '0')}`;
        return transaction.invoice.create({
          data: this.toCreateInput(calculated, invoiceNumber, financialYear(issueDate)),
          include: invoiceWithItems,
        });
      });
      return this.toIssuedInvoice(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException(`Invoice ${calculated.id} already exists`);
      }
      throw error;
    }
  }

  async issue(id: string, issueDate = new Date()): Promise<IssuedInvoice> {
    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const draft = await transaction.invoice.findFirst({
          where: { id, branchId: DEFAULT_BRANCH_ID },
          select: { id: true, status: true, branchStateCode: true },
        });
        if (!draft) throw new NotFoundException(`Invoice draft ${id} was not found`);
        if (draft.status !== InvoiceStatus.DRAFT) throw new BadRequestException('Invoice has already been issued');
        const year = financialYear(issueDate);
        const series = await transaction.numberSeries.upsert({
          where: { branchId_financialYear: { branchId: DEFAULT_BRANCH_ID, financialYear: year } },
          create: { branchId: DEFAULT_BRANCH_ID, financialYear: year, nextNumber: 1 },
          update: { nextNumber: { increment: 1 } },
        });
        const invoiceNumber = `INV${year.slice(0, 2)}${String(series.nextNumber).padStart(4, '0')}`;
        return transaction.invoice.update({
          where: { id },
          data: {
            status: InvoiceStatus.ISSUED,
            invoiceNumber,
            financialYear: year,
            issueDate,
          },
          include: invoiceWithItems,
        });
      });
      return this.toIssuedInvoice(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Invoice number has already been assigned');
      }
      throw error;
    }
  }

  async listIssued(query: PaginationQuery, customerId?: string): Promise<PaginatedResult<InvoiceListItem>> {
    const where: Prisma.InvoiceWhereInput = {
      branchId: DEFAULT_BRANCH_ID,
      ...(customerId ? { customerId } : {}),
      ...(query.search ? {
        OR: [
          { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const totalRecords = await this.prisma.invoice.count({ where });
    const pagination = paginationMetadata(query.page, query.limit, totalRecords);
    const orderBy: Prisma.InvoiceOrderByWithRelationInput = query.sortBy === 'customerName'
      ? { customer: { name: query.sortOrder } }
      : { [query.sortBy]: query.sortOrder };
    const records = await this.prisma.invoice.findMany({
      where,
      orderBy,
      skip: (pagination.currentPage - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        customerId: true,
        customer: { select: { name: true } },
        invoiceNumber: true,
        issueDate: true,
        createdAt: true,
        subtotal: true,
        cgst: true,
        sgst: true,
        igst: true,
        roundOff: true,
        total: true,
        status: true,
      },
    });
    return {
      data: records.map((invoice) => ({
        id: invoice.id,
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoiceNumber ?? 'DRAFT',
        issueDate: (invoice.issueDate ?? invoice.createdAt).toISOString(),
        subtotal: invoice.subtotal.toNumber(),
        cgst: invoice.cgst.toNumber(),
        sgst: invoice.sgst.toNumber(),
        igst: invoice.igst.toNumber(),
        roundOff: invoice.roundOff.toNumber(),
        total: invoice.total.toNumber(),
        status: invoice.status as IssuedInvoice['status'],
      })),
      pagination,
    };
  }

  async findById(id: string): Promise<IssuedInvoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, branchId: DEFAULT_BRANCH_ID },
      include: invoiceWithItems,
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} was not found`);
    return this.toIssuedInvoice(invoice);
  }

  private async calculateInvoice(
    draft: InvoiceDraft,
    status: IssuedInvoice['status'],
    issueDate: Date,
    invoiceNumber: string,
  ): Promise<IssuedInvoice> {
    if (!draft.id?.trim()) throw new BadRequestException('Invoice ID is required');
    if (!draft.customerName?.trim()) throw new BadRequestException('Customer name is required');
    if (!draft.customerStateCode?.trim() || !draft.branchStateCode?.trim()) {
      throw new BadRequestException('Customer and branch state codes are required');
    }
    if (!Array.isArray(draft.lines) || draft.lines.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line');
    }
    if (draft.lines.length > 15) throw new BadRequestException('An invoice can contain at most 15 items');

    const customer = draft.customerId ? await this.customersService.findById(draft.customerId) : undefined;
    const customerStateCode = customer?.stateCode ?? draft.customerStateCode;
    const lines = await Promise.all(draft.lines.map(async (line) => {
      const productId = line.productId?.trim();
      if (!productId) throw new BadRequestException('Every invoice item must be selected from the product catalogue');
      const product = await this.productsService.findById(productId);
      if (!product) throw new BadRequestException(`Product ${productId} was not found`);
      const resolvedLine = {
        ...line,
        productId,
        description: product.name,
        hsnCode: product.hsnCode,
        unit: product.unit,
        gstRate: product.gstRate,
      };
      const discount = resolvedLine.discount ?? 0;
      if (!resolvedLine.description?.trim() || !resolvedLine.hsnCode?.trim() || !resolvedLine.unit?.trim()) {
        throw new BadRequestException('Description, HSN code, and unit are required on every item');
      }
      if (
        !Number.isInteger(resolvedLine.quantity) || resolvedLine.quantity <= 0 ||
        !Number.isFinite(resolvedLine.rate) || resolvedLine.rate < 0 ||
        !Number.isFinite(resolvedLine.gstRate) || resolvedLine.gstRate < 0 ||
        !Number.isInteger(discount) || discount < 0 ||
        discount > resolvedLine.quantity * resolvedLine.rate
      ) {
        throw new BadRequestException('Item quantity must be a positive whole number; discount must be a non-negative whole number; rate and GST rate must be valid');
      }
      const result = calculateGst(resolvedLine, draft.branchStateCode === customerStateCode);
      return {
        ...resolvedLine,
        discount,
        taxableValue: result.taxableValue,
        cgst: result.cgst,
        sgst: result.sgst,
        igst: result.igst,
        total: result.total,
      };
    }));

    const totals = lines.reduce(
      (sum, line) => ({
        subtotal: sum.subtotal + line.quantity * line.rate,
        taxableValue: sum.taxableValue + line.taxableValue,
        cgst: sum.cgst + line.cgst,
        sgst: sum.sgst + line.sgst,
        igst: sum.igst + line.igst,
      }),
      { subtotal: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 },
    );
    const exactTotal = roundMoney(totals.taxableValue + totals.cgst + totals.sgst + totals.igst);
    const total = Math.round(exactTotal);
    return {
      ...draft,
      customerName: customer?.name ?? draft.customerName.trim(),
      customerPhone: customer?.phone ?? draft.customerPhone,
      customerEmail: customer?.email ?? draft.customerEmail,
      customerAddress: customer?.address ?? draft.customerAddress,
      customerGstin: customer?.gstin ?? draft.customerGstin,
      customerStateCode,
      lines,
      status,
      invoiceNumber,
      issueDate: issueDate.toISOString(),
      subtotal: roundMoney(totals.subtotal),
      taxableValue: roundMoney(totals.taxableValue),
      cgst: roundMoney(totals.cgst),
      sgst: roundMoney(totals.sgst),
      igst: roundMoney(totals.igst),
      roundOff: roundMoney(total - exactTotal),
      total,
      amountInWords: amountInWords(total),
    };
  }

  private toCreateInput(invoice: IssuedInvoice, invoiceNumber: string | null, year: string | null): Prisma.InvoiceCreateInput {
    const customerId = invoice.customerId;
    if (!customerId) throw new BadRequestException('Select a customer before creating an invoice');
    const customerSnapshot: Prisma.InputJsonObject = {
      name: invoice.customerName,
      phone: invoice.customerPhone ?? '',
      email: invoice.customerEmail ?? '',
      address: invoice.customerAddress ?? '',
      gstin: invoice.customerGstin ?? '',
      stateCode: invoice.customerStateCode,
    };
    return {
      id: invoice.id,
      branch: { connect: { id: DEFAULT_BRANCH_ID } },
      customer: { connect: { id: customerId } },
      status: invoice.status,
      invoiceNumber,
      financialYear: year,
      issueDate: new Date(invoice.issueDate),
      includeDateTime: invoice.includeDateTime ?? true,
      customerStateCode: invoice.customerStateCode,
      branchStateCode: invoice.branchStateCode,
      subtotal: invoice.subtotal,
      taxableValue: invoice.taxableValue,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      roundOff: invoice.roundOff,
      total: invoice.total,
      amountInWords: invoice.amountInWords,
      customerSnapshot,
      items: {
        create: invoice.lines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description,
          hsnCode: line.hsnCode,
          unit: line.unit,
          quantity: line.quantity,
          rate: line.rate,
          discount: line.discount ?? 0,
          taxableValue: line.taxableValue,
          gstRate: line.gstRate,
          cgst: line.cgst,
          sgst: line.sgst,
          igst: line.igst,
          total: line.total,
          ...(line.productId ? { product: { connect: { id: line.productId } } } : {}),
        })),
      },
    };
  }

  private toIssuedInvoice(invoice: InvoiceWithItems): IssuedInvoice {
    const snapshot = isCustomerSnapshot(invoice.customerSnapshot) ? invoice.customerSnapshot : undefined;
    return {
      id: invoice.id,
      customerId: invoice.customerId,
      customerName: snapshot?.name ?? invoice.customer.name,
      customerPhone: snapshot?.phone ?? invoice.customer.phone ?? undefined,
      customerEmail: snapshot?.email ?? invoice.customer.email ?? undefined,
      customerAddress: snapshot?.address ?? invoice.customer.address,
      customerGstin: snapshot?.gstin || invoice.customer.gstin || undefined,
      includeDateTime: invoice.includeDateTime,
      customerStateCode: snapshot?.stateCode ?? invoice.customerStateCode,
      branchStateCode: invoice.branchStateCode,
      lines: invoice.items.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        hsnCode: line.hsnCode,
        unit: line.unit,
        quantity: line.quantity,
        rate: line.rate.toNumber(),
        discount: line.discount.toNumber(),
        gstRate: line.gstRate.toNumber(),
        taxableValue: line.taxableValue.toNumber(),
        cgst: line.cgst.toNumber(),
        sgst: line.sgst.toNumber(),
        igst: line.igst.toNumber(),
        total: line.total.toNumber(),
      })),
      status: invoice.status as IssuedInvoice['status'],
      invoiceNumber: invoice.invoiceNumber ?? 'DRAFT',
      issueDate: (invoice.issueDate ?? invoice.createdAt).toISOString(),
      subtotal: invoice.subtotal.toNumber(),
      taxableValue: invoice.taxableValue.toNumber(),
      cgst: invoice.cgst.toNumber(),
      sgst: invoice.sgst.toNumber(),
      igst: invoice.igst.toNumber(),
      roundOff: invoice.roundOff.toNumber(),
      total: invoice.total.toNumber(),
      amountInWords: invoice.amountInWords ?? amountInWords(invoice.total.toNumber()),
    };
  }
}

function isCustomerSnapshot(value: Prisma.JsonValue): value is {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  stateCode: string;
} {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    typeof value.name === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.email === 'string' &&
    typeof value.address === 'string' &&
    typeof value.gstin === 'string' &&
    typeof value.stateCode === 'string';
}
