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
      includeDateTime: true,
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
      invoiceNumber: 'INV260001',
      issueDate: '2026-11-11T09:21:58.000Z',
      subtotal: 1000,
      taxableValue: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      roundOff: 0,
      total: 1180,
      amountInWords: 'Rupees One Thousand One Hundred Eighty Only',
    };

    const html = new InvoicePrintService().generate(invoice);
    expect(html).toContain('<table class="items">');
    expect(html).toContain('.sheet { display: flex; flex-direction: column; width: 210mm; min-height: 297mm;');
    expect(html).toContain('.items-area { display: flex; flex: 1 1 0; flex-direction: column; min-height: 24mm;');
    expect(html).toContain('.items { flex: none; width: 100%; border-collapse: collapse; table-layout: fixed; }');
    expect(html).toContain('.items-blank-space { flex: 1 1 auto; width: 100%; min-height: 0; border-collapse: collapse; table-layout: fixed; }');
    expect(html).toContain('.items-blank-space td { height: 100%; padding: 0; border: 0; border-right: 1px solid #45566d; border-bottom: 1px solid #45566d; }');
    expect(html).toContain('<table class="items-blank-space" aria-hidden="true" role="presentation">');
    expect(html).toContain('<tbody><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>');
    expect(html).toContain(':root { color: #172033; font: 12px/1.4 Arial, Helvetica, sans-serif; }');
    expect(html).toContain('-webkit-print-color-adjust: exact; print-color-adjust: exact;');
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('.items td { font-size: 9px; vertical-align: top; }');
    expect(html).toContain('.items tbody tr { height: 1.65em; }');
    expect(html).not.toContain('blank-row');
    expect(html).toContain('.invoice-bottom { flex: none; margin-top: 8px; }');
    expect(html).toContain('.sheet { width: 210mm; height: 297mm; min-height: 0;');
    expect(html.indexOf('<div class="invoice-header">')).toBeLessThan(html.indexOf('<div class="items-area">'));
    expect(html.indexOf('<div class="items-area">')).toBeLessThan(html.indexOf('<div class="invoice-bottom">'));
    expect(html).toContain('Sakshi Swayam Rojgar Stationary Utpadan Kendra');
    expect(html).toContain('2896-1, Bhairavwadi, Near Panchayat Samiti, Main Road Kudal, Tal-Kudal 416520, Dist-Sindhudurg');
    expect(html).toContain('27AOSPC7246L1ZD');
    expect(html).toContain('9823141369');
    expect(html).toContain('BLJPM3008B');
    expect(html).toContain('Bank of Maharashtra');
    expect(html).toContain('60207308004');
    expect(html).toContain('MAHB0000070');
    expect(html).toContain('Invoice date &amp; time:');
    expect(html).toContain('<span class="invoice-date-time">11 November 2026 at 02:51:58 pm IST</span>');
    expect(html).toContain('.invoice-meta > div { white-space: nowrap; }');
    expect(html).toContain('.totals th { width: 68%;');
    expect(html).not.toContain('colspan="2">CGST');
    expect(html).not.toContain('colspan="2">SGST');
    expect(html).toContain('Output CGST @ 9.00%');
    expect(html).toContain('Output SGST @ 9.00%');
    expect(html).toContain('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.');
    expect(html).toContain('This is a Computer Generated Invoice.');
    expect(html).toContain('Print / Save as PDF');
    expect(html).toContain('Business cards');
    expect(html).not.toContain('Original for recipient');
    expect(html).not.toContain('SUBJECT TO KUDAL JURISDICTION');
    expect(html).toContain('INR 1,180');

    const fifteenLineHtml = new InvoicePrintService().generate({
      ...invoice,
      lines: Array.from({ length: 15 }, (_, index) => ({
        ...invoice.lines[0],
        description: `Product ${index + 1}`,
      })),
    });
    expect(fifteenLineHtml.match(/<td>Product \d+<\/td>/g)).toHaveLength(15);
    expect(fifteenLineHtml).not.toContain('blank-row');
  });

  it('leaves invoice date and time blank when it was not requested', () => {
    const invoice: IssuedInvoice = {
      id: 'invoice-date-hidden',
      customerName: 'Apex Architects',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [],
      status: 'ISSUED',
      invoiceNumber: 'INV260002',
      issueDate: '2026-11-11T00:00:00.000Z',
      subtotal: 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      roundOff: 0,
      total: 0,
      amountInWords: 'Rupees Zero Only',
    };

    const html = new InvoicePrintService().generate(invoice);
    expect(html).toContain('<strong>Invoice date &amp; time:</strong> </div>');
    expect(html).not.toContain('11 November 2026');
  });
});
