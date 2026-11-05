import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { amountInWords, roundMoney } from '../common/money.js';
import { calculateGst, financialYear } from './gst-calculator.js';

export interface InvoiceDraftLine {
  description: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  rate: number;
  discount?: number;
  gstRate: number;
  productId?: string;
}

export interface InvoiceDraft {
  id: string;
  customerName: string;
  customerStateCode: string;
  branchStateCode: string;
  lines: InvoiceDraftLine[];
}

export interface IssuedInvoice extends InvoiceDraft {
  status: 'ISSUED';
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
  private readonly drafts = new Map<string, InvoiceDraft>();
  private readonly issued = new Map<string, IssuedInvoice>();
  private readonly series = new Map<string, number>();

  createDraft(draft: InvoiceDraft): InvoiceDraft {
    if (!draft.lines.length) throw new BadRequestException('An invoice must contain at least one line');
    this.drafts.set(draft.id, draft);
    return draft;
  }

  issue(id: string, issueDate = new Date()): IssuedInvoice {
    const draft = this.drafts.get(id);
    if (!draft) throw new NotFoundException(`Invoice draft ${id} was not found`);
    if (this.issued.has(id)) throw new BadRequestException('Invoice has already been issued');
    for (const line of draft.lines) {
      if (!line.hsnCode.trim()) throw new BadRequestException('HSN code is required on every line');
      if (line.quantity <= 0 || line.rate < 0 || line.gstRate < 0) {
        throw new BadRequestException('Quantity, rate, and GST rate must be valid positive values');
      }
    }

    const year = financialYear(issueDate);
    const key = `${year}:${draft.branchStateCode}`;
    const next = (this.series.get(key) ?? 0) + 1;
    const invoiceNumber = `INV/${year}/${String(next).padStart(5, '0')}`;
    const sameState = draft.branchStateCode === draft.customerStateCode;
    const totals = draft.lines.reduce(
      (sum, line) => {
        const result = calculateGst(line, sameState);
        return {
          subtotal: sum.subtotal + line.quantity * line.rate,
          taxableValue: sum.taxableValue + result.taxableValue,
          cgst: sum.cgst + result.cgst,
          sgst: sum.sgst + result.sgst,
          igst: sum.igst + result.igst,
        };
      },
      { subtotal: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 },
    );
    const total = roundMoney(totals.taxableValue + totals.cgst + totals.sgst + totals.igst);
    const invoice: IssuedInvoice = {
      ...draft,
      status: 'ISSUED',
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
    this.series.set(key, next);
    this.issued.set(id, invoice);
    this.drafts.delete(id);
    return invoice;
  }

  listIssued(): IssuedInvoice[] {
    return [...this.issued.values()];
  }
}
