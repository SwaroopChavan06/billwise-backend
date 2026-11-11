import { InvoicePdfService } from './invoice-pdf.service';
import type { IssuedInvoice } from '../../invoicing/invoicing.service';

describe('InvoicePdfService', () => {
  it('generates a downloadable PDF for an invoice', async () => {
    const invoice: IssuedInvoice = {
      id: 'invoice-pdf-test',
      customerId: 'cust-1',
      customerName: 'Apex Architects',
      customerPhone: '+91 98765 43210',
      customerEmail: 'accounts@apex.example',
      customerAddress: 'Mumbai',
      customerGstin: '27ABCDE1234F1Z5',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [{
        productId: 'prod-business-cards',
        description: 'Business cards',
        hsnCode: '4911',
        unit: 'box',
        quantity: 1,
        rate: 1000,
        discount: 0,
        gstRate: 18,
        taxableValue: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        total: 1180,
      }],
      status: 'ISSUED',
      invoiceNumber: 'INV/26-27/00001',
      issueDate: '2026-11-11T00:00:00.000Z',
      subtotal: 1000,
      taxableValue: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      total: 1180,
      amountInWords: 'Rupees One Thousand One Hundred Eighty Only',
    };

    const pdf = await new InvoicePdfService().generate(invoice);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
