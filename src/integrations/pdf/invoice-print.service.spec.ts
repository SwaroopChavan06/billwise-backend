import { InvoicePrintService } from './invoice-print.service';
import type { IssuedInvoice } from '../../invoicing/invoicing.service';

describe('InvoicePrintService', () => {
  it('renders an HTML tax invoice with printable details', () => {
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

    const html = new InvoicePrintService().generate(invoice);
    expect(html).toContain('<table class="items">');
    expect(html).toContain('Sakshi Swayamrojgar Utpadan Kendra Kudal');
    expect(html).toContain('At Post Kudal, Bhairavwadi, Tal. Kudal, Dist. Sindhudurg, Maharashtra - 416520');
    expect(html).toContain('27AAAAA0000A1Z5 (SAMPLE - REPLACE WITH ACTUAL GSTIN)');
    expect(html).toContain('Invoice date &amp; time:');
    expect(html).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(html).toContain('Print / Save as PDF');
    expect(html).toContain('Business cards');
    expect(html).toContain('0000000000 (SAMPLE)');
  });
});
