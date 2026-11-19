import { Injectable } from '@nestjs/common';
import type { CalculatedInvoiceLine, IssuedInvoice } from '../../invoicing/invoicing.service.js';

const SINGLE_PAGE_ITEM_LIMIT = 20;
const CONTINUATION_PAGE_ITEM_LIMIT = 25;
const FINAL_PAGE_ITEM_LIMIT = 12;

const supplier = {
  name: 'Sakshi Swayam Rojgar Stationary Utpadan Kendra',
  address: '2896-1, Bhairavwadi, Near Panchayat Samiti, Main Road Kudal, Tal-Kudal 416520, Dist-Sindhudurg',
  phone: '9823141369',
  gstin: '27AOSPC7246L1ZD',
  state: 'Maharashtra',
  stateCode: '27',
  pan: 'BLJPM3008B',
  bankName: 'Bank of Maharashtra',
  accountNumber: '60207308004',
  branch: 'KUDAL',
  ifsc: 'MAHB0000070',
  jurisdiction: 'Kudal',
  declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
};

@Injectable()
export class InvoicePrintService {
  generate(invoice: IssuedInvoice): string {
    const issuedDate = new Date(invoice.issueDate);
    const date = issuedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const timeParts = new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).formatToParts(issuedDate);
    const timePart = (type: Intl.DateTimeFormatPartTypes) =>
      timeParts.find((part) => part.type === type)?.value ?? '';
    const invoiceDateTime = invoice.includeDateTime
      ? `${date} at ${timePart('hour')}:${timePart('minute')}:${timePart('second')} ${timePart('dayPeriod').toLowerCase()} IST`
      : '';
    const pages = paginateInvoiceLines(invoice.lines);
    const taxRows = invoice.igst > 0
      ? `<tr><th>Output IGST @ ${formatTaxRate(invoice.igst, invoice.taxableValue)}%</th><td class="number">${formatMoney(invoice.igst)}</td></tr>`
      : `<tr><th>Output CGST @ ${formatTaxRate(invoice.cgst, invoice.taxableValue)}%</th><td class="number">${formatMoney(invoice.cgst)}</td></tr>
         <tr><th>Output SGST @ ${formatTaxRate(invoice.sgst, invoice.taxableValue)}%</th><td class="number">${formatMoney(invoice.sgst)}</td></tr>`;
    const header = `
      <div class="invoice-header">
        <div class="document-heading"><h1>TAX INVOICE</h1></div>
        <header class="supplier">
          <h2>${escapeHtml(supplier.name)}</h2>
          <p class="supplier-address">${escapeHtml(supplier.address)}</p>
          <div class="supplier-identity">
            <span><strong>Ph. No.:</strong> ${escapeHtml(supplier.phone)}</span>
            <span><strong>GSTIN/UIN:</strong> ${escapeHtml(supplier.gstin)}</span>
            <span><strong>State:</strong> ${escapeHtml(supplier.state)}, Code: ${escapeHtml(supplier.stateCode)}</span>
          </div>
        </header>
        <section class="invoice-meta">
          <div><strong>Invoice number:</strong> ${escapeHtml(invoice.invoiceNumber || 'DRAFT')}</div>
          <div><strong>Invoice date &amp; time:</strong> ${invoiceDateTime ? `<span class="invoice-date-time">${escapeHtml(invoiceDateTime)}</span>` : ''}</div>
        </section>
      </div>`;
    const partyDetails = `
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
          <p><strong>Place of supply:</strong> ${escapeHtml(invoice.customerStateCode === supplier.stateCode ? supplier.state : invoice.customerStateCode)}</p>
          <p><strong>Reverse charge:</strong> No</p>
        </section>
      </section>`;
    const bottom = `
      <div class="invoice-bottom">
        <section class="summary-grid">
          <div>
            <div class="words"><strong>Amount chargeable (in words)</strong>${escapeHtml(invoice.amountInWords)}</div>
            <div class="bank">
              <h3>Company's bank details</h3>
              <p><strong>Bank:</strong> ${escapeHtml(supplier.bankName)}</p>
              <p><strong>A/c No.:</strong> ${escapeHtml(supplier.accountNumber)}</p>
              <p><strong>Branch &amp; IFS Code:</strong> ${escapeHtml(supplier.branch)} &amp; ${escapeHtml(supplier.ifsc)}</p>
            </div>
          </div>
          <div>
            <table class="totals">
              <tr><th>Subtotal</th><td class="number">${formatMoney(invoice.subtotal)}</td></tr>
              <tr><th>Taxable value</th><td class="number">${formatMoney(invoice.taxableValue)}</td></tr>
              ${taxRows}
              ${invoice.roundOff ? `<tr><th>Round off</th><td class="number">${formatMoney(invoice.roundOff)}</td></tr>` : ''}
              <tr class="grand-total"><th>Total</th><td class="number">INR ${formatWholeMoney(invoice.total)}</td></tr>
            </table>
          </div>
        </section>
        <section class="bottom-grid">
          <div class="declaration">
            <h3>Company's PAN: ${escapeHtml(supplier.pan)}</h3>
            <strong>Declaration</strong>
            <p>${escapeHtml(supplier.declaration)}</p>
          </div>
          <div class="signature"><strong>For ${escapeHtml(supplier.name)}</strong><span>Authorised Signatory</span></div>
        </section>
      </div>`;
    const pageMarkup = pages.map((pageLines, pageIndex) => {
      const isLastPage = pageIndex === pages.length - 1;
      const firstLineNumber = pages.slice(0, pageIndex).reduce((total, items) => total + items.length, 0);
      const rows = pageLines.map((line, index) => renderLine(line, firstLineNumber + index + 1)).join('');
      return `
        <main class="sheet">
          ${header}
          ${pageIndex === 0 ? partyDetails : ''}
          <div class="items-area">
            <table class="items">
              <thead><tr><th>Sr. no.</th><th>Description of goods and services</th><th>HSN/SAC</th><th>GST</th><th>Quantity</th><th>Rate (INR)</th><th>Discount</th><th>Taxable value</th><th>Amount (INR)</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${isLastPage ? bottom : ''}
          <footer class="page-footer ${isLastPage ? '' : 'continuation-footer'}">
            ${isLastPage
              ? '<p class="generated">This is a Computer Generated Invoice.</p>'
              : '<p class="continued">Continued on next page &rarr;</p>'}
            <p>Page ${pageIndex + 1} of ${pages.length}</p>
          </footer>
        </main>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tax invoice ${escapeHtml(invoice.invoiceNumber || invoice.id)}</title>
  <style>
    :root { color: #172033; font: 12px/1.4 Arial, Helvetica, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef1f5; }
    .toolbar { max-width: 210mm; margin: 16px auto 0; display: flex; justify-content: flex-end; }
    .toolbar button { border: 0; border-radius: 5px; background: #1d3557; color: white; padding: 10px 16px; font-size: 13px; cursor: pointer; }
    .sheet { display: flex; flex-direction: column; width: 210mm; min-height: 297mm; margin: 12px auto 24px; padding: 12mm; background: white; box-shadow: 0 4px 24px #1720331a; }
    .invoice-header { flex: none; }
    .document-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .document-heading h1 { margin: 0; font-size: 17px; letter-spacing: 1.2px; }
    .copy-label { border: 1px solid #52647a; padding: 4px 8px; color: #52647a; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .supplier { border: 1px solid #45566d; padding: 12px 14px; text-align: center; }
    .supplier h2 { margin: 0 0 5px; color: #152840; font-size: 17px; }
    .supplier p { margin: 3px 0; }
    .supplier .supplier-address { max-width: 560px; margin: 0 auto; }
    .supplier .supplier-identity { display: flex; justify-content: center; flex-wrap: wrap; column-gap: 18px; margin-top: 6px; font-size: 10px; }
    .invoice-meta { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #45566d; border-top: 0; }
    .invoice-meta { grid-template-columns: 1fr 1.2fr; align-items: center; font-size: 10px; }
    .invoice-meta > div { min-width: 0; padding: 9px 11px; }
    .invoice-meta > div { white-space: nowrap; }
    .invoice-meta > div + div { border-left: 1px solid #45566d; }
    .invoice-date-time { white-space: nowrap; }
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #45566d; border-top: 0; }
    .party-grid > section { min-width: 0; padding: 9px 11px; }
    .party-grid > section + section { border-left: 1px solid #45566d; }
    .party-grid h3 { margin: 0 0 7px; padding: 6px 8px; background: #edf2f7; color: #26364d; font-size: 10px; letter-spacing: .5px; text-transform: uppercase; }
    .party-grid p { margin: 3px 0; }
    .items-area { display: flex; flex: 1 1 0; flex-direction: column; min-height: 0; margin-top: 8px; }
    .items { flex: 1 1 auto; width: 100%; height: 100%; min-height: 0; border-collapse: collapse; table-layout: fixed; }
    .items tbody { height: 100%; }
    .items th, .items td { border: 1px solid #45566d; padding: 6px 4px; overflow-wrap: anywhere; }
    .items thead th { background: #edf2f7; color: #26364d; font-size: 9px; text-align: center; }
    .items tbody tr { height: 1.65em; }
    .items td { font-size: 9px; vertical-align: top; }
    .items th:nth-child(1) { width: 5%; }.items th:nth-child(2) { width: 23%; }.items th:nth-child(3) { width: 9%; }
    .items th:nth-child(4) { width: 8%; }.items th:nth-child(5) { width: 11%; }.items th:nth-child(6) { width: 8%; }
    .items th:nth-child(7) { width: 12%; }.items th:nth-child(8) { width: 8%; }.items th:nth-child(9) { width: 16%; }
    .center { text-align: center; }.number { text-align: right; white-space: nowrap; }
    .invoice-bottom { flex: none; margin-top: 8px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 250px; gap: 14px; align-items: start; }
    .words, .bank, .declaration, .signature { border: 1px solid #45566d; padding: 9px 10px; }
    .words { min-height: 56px; }.words strong, .bank h3, .declaration h3 { display: block; margin: 0 0 5px; font-size: 10px; }
    .bank { margin-top: 9px; }.bank p { margin: 3px 0; font-size: 9px; }
    .totals { width: 100%; table-layout: fixed; border-collapse: collapse; }
    .totals th, .totals td { height: 28px; border: 1px solid #45566d; padding: 5px 7px; font-size: 10px; }
    .totals th { width: 68%; text-align: left; font-weight: 500; }.totals td { width: 32%; }
    .totals .grand-total th, .totals .grand-total td { height: 34px; background: #edf2f7; font-weight: 700; font-size: 12px; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 250px; gap: 14px; margin-top: 8px; align-items: stretch; }
    .declaration { font-size: 9px; }.signature { display: flex; min-height: 92px; flex-direction: column; justify-content: space-between; text-align: right; font-size: 10px; }
    .signature span { padding-top: 32px; }
    .page-footer { display: flex; flex: none; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 8px; color: #435168; font-size: 9px; }
    .page-footer p { margin: 3px 0; }.page-footer .generated { font-weight: 700; }
    @page { size: A4; margin: 0; }
    @media print { body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }.toolbar { display: none; }.sheet { width: 210mm; height: 297mm; min-height: 0; margin: 0; padding: 10mm; box-shadow: none; break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always; }.sheet:last-of-type { break-after: auto; page-break-after: auto; }.invoice-header, .invoice-bottom { break-inside: avoid; }.items-area { min-height: 0; margin-top: 6px; }.items th, .items td { padding: 4px 3px; }.items tbody tr { height: 1.5em; }.summary-grid { grid-template-columns: 1fr 230px; gap: 8px; }.words, .bank, .declaration, .signature { padding: 6px 8px; }.words { min-height: 0; }.bank { margin-top: 6px; }.totals th, .totals td { height: 22px; padding: 3px 5px; }.totals .grand-total th, .totals .grand-total td { height: 27px; }.bottom-grid { grid-template-columns: 1fr 230px; gap: 8px; margin-top: 6px; }.signature { min-height: 68px; }.signature span { padding-top: 20px; }.page-footer { padding-top: 5px; } tr { break-inside: avoid; } }
    @media screen and (max-width: 760px) { .sheet { width: 100%; min-height: 100vh; margin: 0; padding: 16px; overflow-x: auto; }.items { min-width: 680px; }.toolbar { margin: 10px; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  ${pageMarkup}
</body>
</html>`;
  }
}

function paginateInvoiceLines(lines: CalculatedInvoiceLine[]): CalculatedInvoiceLine[][] {
  if (lines.length <= SINGLE_PAGE_ITEM_LIMIT) return [lines];

  const continuationPageCount = Math.ceil((lines.length - FINAL_PAGE_ITEM_LIMIT) / CONTINUATION_PAGE_ITEM_LIMIT);
  const continuationItems = lines.length - FINAL_PAGE_ITEM_LIMIT;
  const baseItemsPerPage = Math.floor(continuationItems / continuationPageCount);
  const extraItems = continuationItems % continuationPageCount;
  const pages: CalculatedInvoiceLine[][] = [];
  let start = 0;
  for (let page = 0; page < continuationPageCount; page += 1) {
    const count = baseItemsPerPage + (page < extraItems ? 1 : 0);
    pages.push(lines.slice(start, start + count));
    start += count;
  }
  pages.push(lines.slice(start));
  return pages;
}

function renderLine(line: CalculatedInvoiceLine, number: number): string {
  return `
    <tr>
      <td class="center">${number}</td>
      <td>${escapeHtml(line.description)}</td>
      <td class="center">${escapeHtml(line.hsnCode)}</td>
      <td class="center">${formatQuantity(line.gstRate)}%</td>
      <td class="number">${formatQuantity(line.quantity)} ${escapeHtml(line.unit)}</td>
      <td class="number">${formatMoney(line.rate)}</td>
      <td class="number">${formatMoney(line.discount ?? 0)}</td>
      <td class="number">${formatMoney(line.taxableValue)}</td>
      <td class="number">${formatMoney(line.total)}</td>
    </tr>`;
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

function formatWholeMoney(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatTaxRate(tax: number, taxableValue: number): string {
  if (taxableValue === 0) return '0.00';
  return ((tax / taxableValue) * 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}
