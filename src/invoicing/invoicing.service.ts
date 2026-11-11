import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { amountInWords, roundMoney } from '../common/money.js';
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
  total: number;
  amountInWords: string;
}

@Injectable()
export class InvoicingService {
  private readonly drafts = new Map<string, IssuedInvoice>();
  private readonly issued = new Map<string, IssuedInvoice>();
  private readonly series = new Map<string, number>();

  constructor(
    private readonly productsService: ProductsService,
    private readonly customersService: CustomersService,
  ) {}

  createDraft(draft: InvoiceDraft): IssuedInvoice {
    const invoice = this.calculateInvoice(draft, 'DRAFT', new Date(), 'DRAFT');
    this.drafts.set(invoice.id, invoice);
    return invoice;
  }

  create(draft: InvoiceDraft, issueDate = new Date()): IssuedInvoice {
    if (this.issued.has(draft.id) || this.drafts.has(draft.id)) {
      throw new BadRequestException(`Invoice ${draft.id} already exists`);
    }
    const calculated = this.calculateInvoice(draft, 'ISSUED', issueDate, '');
    const year = financialYear(issueDate);
    const key = `${year}:${calculated.branchStateCode}`;
    const next = (this.series.get(key) ?? 0) + 1;
    const invoice = {
      ...calculated,
      invoiceNumber: `INV/${year}/${String(next).padStart(5, '0')}`,
    };
    this.series.set(key, next);
    this.issued.set(invoice.id, invoice);
    return invoice;
  }

  issue(id: string, issueDate = new Date()): IssuedInvoice {
    const draft = this.drafts.get(id);
    if (!draft) {
      if (this.issued.has(id)) throw new BadRequestException('Invoice has already been issued');
      throw new NotFoundException(`Invoice draft ${id} was not found`);
    }

    const year = financialYear(issueDate);
    const key = `${year}:${draft.branchStateCode}`;
    const next = (this.series.get(key) ?? 0) + 1;
    const invoice = {
      ...draft,
      status: 'ISSUED' as const,
      invoiceNumber: `INV/${year}/${String(next).padStart(5, '0')}`,
      issueDate: issueDate.toISOString(),
    };
    this.series.set(key, next);
    this.issued.set(id, invoice);
    this.drafts.delete(id);
    return invoice;
  }

  listIssued(): IssuedInvoice[] {
    return [...this.issued.values(), ...this.drafts.values()];
  }

  findById(id: string): IssuedInvoice {
    const invoice = this.issued.get(id) ?? this.drafts.get(id);
    if (!invoice) throw new NotFoundException(`Invoice ${id} was not found`);
    return invoice;
  }

  private calculateInvoice(
    draft: InvoiceDraft,
    status: IssuedInvoice['status'],
    issueDate: Date,
    invoiceNumber: string,
  ): IssuedInvoice {
    if (!draft.id?.trim()) throw new BadRequestException('Invoice ID is required');
    if (!draft.customerName?.trim()) throw new BadRequestException('Customer name is required');
    if (!draft.customerStateCode?.trim() || !draft.branchStateCode?.trim()) {
      throw new BadRequestException('Customer and branch state codes are required');
    }
    if (!Array.isArray(draft.lines) || draft.lines.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line');
    }
    if (draft.lines.length > 15) throw new BadRequestException('An invoice can contain at most 15 items');

    const customer = draft.customerId ? this.customersService.findById(draft.customerId) : undefined;
    const customerStateCode = customer?.stateCode ?? draft.customerStateCode;
    const lines = draft.lines.map((line) => {
      const product = line.productId ? this.productsService.findById(line.productId) : undefined;
      if (line.productId && !product) throw new BadRequestException(`Product ${line.productId} was not found`);
      const resolvedLine = product
        ? { ...line, description: product.name, hsnCode: product.hsnCode, unit: product.unit, rate: product.sellingPrice, gstRate: product.gstRate }
        : line;
      const discount = resolvedLine.discount ?? 0;
      if (!resolvedLine.description?.trim() || !resolvedLine.hsnCode?.trim() || !resolvedLine.unit?.trim()) {
        throw new BadRequestException('Description, HSN code, and unit are required on every item');
      }
      if (
        !Number.isFinite(resolvedLine.quantity) || resolvedLine.quantity <= 0 ||
        !Number.isFinite(resolvedLine.rate) || resolvedLine.rate < 0 ||
        !Number.isFinite(resolvedLine.gstRate) || resolvedLine.gstRate < 0 ||
        !Number.isFinite(discount) || discount < 0 ||
        discount > resolvedLine.quantity * resolvedLine.rate
      ) {
        throw new BadRequestException('Item quantity, rate, discount, and GST rate must be valid non-negative values');
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
    });

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
    const total = roundMoney(totals.taxableValue + totals.cgst + totals.sgst + totals.igst);
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
      total,
      amountInWords: amountInWords(total),
    };
  }
}
