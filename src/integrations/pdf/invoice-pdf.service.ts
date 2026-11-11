import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { IssuedInvoice } from '../../invoicing/invoicing.service.js';

@Injectable()
export class InvoicePdfService {
  generate(invoice: IssuedInvoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      document.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE');
      document.moveDown(0.35);
      document.fontSize(10).font('Helvetica').text('Billwise');
      document.text(`Invoice number: ${invoice.invoiceNumber}`);
      document.text(`Invoice date: ${new Date(invoice.issueDate).toLocaleDateString('en-IN')}`);
      document.moveDown();

      document.font('Helvetica-Bold').text('Bill to');
      document.font('Helvetica').text(invoice.customerName);
      if (invoice.customerAddress) document.text(invoice.customerAddress);
      if (invoice.customerPhone) document.text(`Phone: ${invoice.customerPhone}`);
      if (invoice.customerEmail) document.text(`Email: ${invoice.customerEmail}`);
      if (invoice.customerGstin) document.text(`GSTIN: ${invoice.customerGstin}`);
      document.text(`Place of supply: ${invoice.customerStateCode}`);
      document.moveDown();

      const columns = { description: 48, hsn: 202, quantity: 257, rate: 315, taxable: 370, gstRate: 430, total: 480 };
      document.font('Helvetica-Bold').fontSize(9);
      const headerY = document.y;
      document.text('Description', columns.description, headerY, { width: 145 });
      document.text('HSN', columns.hsn, headerY);
      document.text('Qty', columns.quantity, headerY);
      document.text('Rate', columns.rate, headerY);
      document.text('Taxable', columns.taxable, headerY);
      document.text('GST %', columns.gstRate, headerY);
      document.text('Total', columns.total, headerY);
      document.y = headerY + 16;
      document.moveTo(48, document.y).lineTo(547, document.y).strokeColor('#d8d8df').stroke();
      document.moveDown(0.5);

      invoice.lines.forEach((line) => {
        if (document.y > 690) document.addPage();
        const rowY = document.y;
        document.font('Helvetica').fontSize(9);
        document.text(line.description, columns.description, rowY, { width: 145 });
        document.text(line.hsnCode, columns.hsn, rowY);
        document.text(`${line.quantity} ${line.unit}`, columns.quantity, rowY);
        document.text(formatMoney(line.rate), columns.rate, rowY);
        document.text(formatMoney(line.taxableValue), columns.taxable, rowY);
        document.text(`${line.gstRate}%`, columns.gstRate, rowY);
        document.text(formatMoney(line.total), columns.total, rowY);
        document.y = Math.max(rowY + 24, rowY + document.heightOfString(line.description, { width: 145 }) + 6);
      });

      if (document.y > 660) document.addPage();
      document.moveDown();
      document.font('Helvetica').fontSize(10);
      document.text(`Subtotal: ${formatMoney(invoice.subtotal)}`, { align: 'right' });
      document.text(`Taxable value: ${formatMoney(invoice.taxableValue)}`, { align: 'right' });
      if (invoice.igst > 0) document.text(`IGST: ${formatMoney(invoice.igst)}`, { align: 'right' });
      else {
        document.text(`CGST: ${formatMoney(invoice.cgst)}`, { align: 'right' });
        document.text(`SGST: ${formatMoney(invoice.sgst)}`, { align: 'right' });
      }
      document.font('Helvetica-Bold').fontSize(12).text(`Total: ${formatMoney(invoice.total)}`, { align: 'right' });
      document.moveDown();
      document.font('Helvetica').fontSize(9).text(invoice.amountInWords);
      document.end();
    });
  }
}

function formatMoney(value: number): string {
  return `INR ${value.toFixed(2)}`;
}
