import { Injectable } from '@nestjs/common';
import type { IssuedInvoice } from '../../invoicing/invoicing.service.js';

const supplier = {
  name: 'Sakshi Swayamrojgar Utpadan Kendra Kudal',
  address: 'At Post Kudal, Bhairavwadi, Tal. Kudal, Dist. Sindhudurg, Maharashtra - 416520',
  gstin: '27AAAAA0000A1Z5 (SAMPLE - REPLACE WITH ACTUAL GSTIN)',
  bankName: 'Sample Bank (replace with actual bank)',
  accountName: 'Sakshi Swayamrojgar Utpadan Kendra Kudal',
  accountNumber: '0000000000 (SAMPLE)',
  ifsc: 'SAMP0000000 (SAMPLE)',
  branch: 'Kudal (SAMPLE)',
};

@Injectable()
export class InvoicePrintService {
  generate(invoice: IssuedInvoice): string {
    const issuedAt = new Date(invoice.issueDate).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
    const lines = invoice.lines.map((line, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(line.description)}</td>
        <td class="center">${escapeHtml(line.hsnCode)}</td>
        <td class="number">${formatQuantity(line.quantity)} ${escapeHtml(line.unit)}</td>
        <td class="number">${formatMoney(line.rate)}</td>
        <td class="number">${formatMoney(line.discount ?? 0)}</td>
        <td class="number">${formatMoney(line.taxableValue)}</td>
        <td class="center">${formatQuantity(line.gstRate)}%</td>
        <td class="number">${formatMoney(line.total)}</td>
      </tr>`).join('');
    const taxRows = invoice.igst > 0
      ? `<tr><th colspan="2">IGST</th><td class="number">${formatMoney(invoice.igst)}</td></tr>`
      : `<tr><th colspan="2">CGST</th><td class="number">${formatMoney(invoice.cgst)}</td></tr>
         <tr><th colspan="2">SGST</th><td class="number">${formatMoney(invoice.sgst)}</td></tr>`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tax invoice ${escapeHtml(invoice.invoiceNumber || invoice.id)}</title>
  <style>
    :root { color: #172033; font: 13px/1.45 Arial, Helvetica, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #edf0f4; }
    .toolbar { max-width: 210mm; margin: 16px auto 0; display: flex; justify-content: flex-end; }
    .toolbar button { border: 0; border-radius: 5px; background: #1d3557; color: white; padding: 10px 16px; font-size: 13px; cursor: pointer; }
    .sheet { width: 210mm; min-height: 297mm; margin: 12px auto 24px; padding: 14mm; background: white; box-shadow: 0 4px 24px #1720331a; }
    .title { margin: 0 0 12px; text-align: center; font-size: 18px; letter-spacing: 1.5px; }
    .supplier { border: 1px solid #26364d; padding: 12px 14px; text-align: center; }
    .supplier h2 { margin: 0 0 5px; font-size: 17px; }
    .supplier p { margin: 2px 0; }
    .invoice-meta, .party-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #26364d; border-top: 0; }
    .invoice-meta > div, .party-grid > section { padding: 9px 11px; }
    .invoice-meta > div + div, .party-grid > section + section { border-left: 1px solid #26364d; }
    .party-grid h3 { margin: 0 0 6px; background: #edf2f7; padding: 6px; font-size: 12px; text-transform: uppercase; }
    .party-grid p { margin: 3px 0; }
    .items { width: 100%; margin-top: 14px; border-collapse: collapse; table-layout: fixed; }
    .items th, .items td { border: 1px solid #26364d; padding: 7px 5px; overflow-wrap: anywhere; }
    .items thead th { background: #edf2f7; font-size: 10px; text-align: center; }
    .items td { font-size: 10px; }
    .items th:nth-child(1) { width: 5%; }.items th:nth-child(2) { width: 22%; }.items th:nth-child(3) { width: 9%; }
    .items th:nth-child(4) { width: 11%; }.items th:nth-child(5) { width: 11%; }.items th:nth-child(6) { width: 9%; }
    .items th:nth-child(7) { width: 12%; }.items th:nth-child(8) { width: 7%; }.items th:nth-child(9) { width: 14%; }
    .center { text-align: center; }.number { text-align: right; white-space: nowrap; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 245px; gap: 16px; margin-top: 12px; align-items: start; }
    .words, .bank, .signature { border: 1px solid #26364d; padding: 9px 10px; }
    .words { margin-bottom: 12px; }.words strong, .bank h3 { display: block; margin: 0 0 5px; font-size: 11px; }
    .bank p { margin: 3px 0; font-size: 10px; }.bank .sample { color: #8a4b08; }
    .totals { width: 100%; border-collapse: collapse; }.totals th, .totals td { border: 1px solid #26364d; padding: 7px 8px; }.totals th { text-align: left; font-weight: normal; }.totals .grand-total th, .totals .grand-total td { background: #edf2f7; font-weight: bold; font-size: 14px; }
    .signature { min-height: 74px; margin-top: 12px; text-align: right; }.signature span { display: block; margin-top: 30px; }
    .footnote { margin-top: 16px; text-align: center; font-size: 10px; color: #5d6877; }
    @page { size: A4; margin: 0; }
    @media print { body { background: white; }.toolbar { display: none; }.sheet { width: auto; min-height: 0; margin: 0; padding: 12mm; box-shadow: none; } tr { break-inside: avoid; } }
    @media screen and (max-width: 760px) { .sheet { width: 100%; min-height: 100vh; margin: 0; padding: 16px; overflow-x: auto; }.items { min-width: 680px; }.toolbar { margin: 10px; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <main class="sheet">
    <h1 class="title">TAX INVOICE</h1>
    <header class="supplier">
      <h2>${escapeHtml(supplier.name)}</h2>
      <p>${escapeHtml(supplier.address)}</p>
      <p><strong>GSTIN:</strong> ${escapeHtml(supplier.gstin)}</p>
    </header>
    <section class="invoice-meta">
      <div><strong>Invoice number:</strong> ${escapeHtml(invoice.invoiceNumber || 'DRAFT')}</div>
      <div><strong>Invoice date &amp; time:</strong> ${escapeHtml(issuedAt)} IST</div>
    </section>
    <section class="party-grid">
      <section>
        <h3>Bill to</h3>
        <p><strong>${escapeHtml(invoice.customerName)}</strong></p>
        ${invoice.customerAddress ? `<p>${escapeHtml(invoice.customerAddress)}</p>` : ''}
        ${invoice.customerPhone ? `<p>Phone: ${escapeHtml(invoice.customerPhone)}</p>` : ''}
        ${invoice.customerEmail ? `<p>Email: ${escapeHtml(invoice.customerEmail)}</p>` : ''}
        ${invoice.customerGstin ? `<p>GSTIN: ${escapeHtml(invoice.customerGstin)}</p>` : ''}
      </section>
      <section>
        <h3>Supply details</h3>
        <p><strong>Place of supply:</strong> ${escapeHtml(invoice.customerStateCode)}</p>
        <p><strong>Reverse charge:</strong> No</p>
      </section>
    </section>
    <table class="items">
      <thead><tr><th>Sr. no.</th><th>Description</th><th>HSN</th><th>Quantity</th><th>Rate (INR)</th><th>Discount</th><th>Taxable value</th><th>GST</th><th>Line total (INR)</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <section class="bottom-grid">
      <div>
        <div class="words"><strong>Amount in words</strong>${escapeHtml(invoice.amountInWords)}</div>
        <div class="bank">
          <h3>Bank details <span class="sample">- SAMPLE DETAILS, REPLACE BEFORE USE</span></h3>
          <p><strong>Account name:</strong> ${escapeHtml(supplier.accountName)}</p>
          <p><strong>Bank:</strong> ${escapeHtml(supplier.bankName)}</p>
          <p><strong>Account number:</strong> ${escapeHtml(supplier.accountNumber)}</p>
          <p><strong>IFSC:</strong> ${escapeHtml(supplier.ifsc)}</p>
          <p><strong>Branch:</strong> ${escapeHtml(supplier.branch)}</p>
        </div>
      </div>
      <div>
        <table class="totals">
          <tr><th>Subtotal</th><td class="number">${formatMoney(invoice.subtotal)}</td></tr>
          <tr><th>Taxable value</th><td class="number">${formatMoney(invoice.taxableValue)}</td></tr>
          ${taxRows}
          <tr class="grand-total"><th>Total</th><td class="number">INR ${formatMoney(invoice.total)}</td></tr>
        </table>
        <div class="signature"><strong>For ${escapeHtml(supplier.name)}</strong><span>Authorised signature</span></div>
      </div>
    </section>
    <p class="footnote">This is a computer-generated invoice.</p>
  </main>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQuantity(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}
