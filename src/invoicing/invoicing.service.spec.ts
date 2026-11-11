import { BadRequestException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { ProductsService } from '../products/products.service';
import { InvoicingService } from './invoicing.service';

describe('InvoicingService', () => {
  let service: InvoicingService;

  beforeEach(() => {
    service = new InvoicingService(new ProductsService(), new CustomersService());
  });

  it('creates an invoice with catalog prices, customer details, and calculated taxes', () => {
    const invoice = service.create({
      id: 'invoice-test-1',
      customerId: 'cust-3',
      customerName: 'Ignored client value',
      customerStateCode: '00',
      branchStateCode: '27',
      lines: [
        { productId: 'prod-business-cards', description: 'Ignored', hsnCode: '0', unit: '0', quantity: 2, rate: 1, gstRate: 0 },
      ],
    });

    expect(invoice.status).toBe('ISSUED');
    expect(invoice.invoiceNumber).toMatch(/^INV\/\d{2}-\d{2}\/\d{5}$/);
    expect(invoice.customerName).toBe('Northstar Retail');
    expect(invoice.customerPhone).toBe('+91 98100 44556');
    expect(invoice.customerEmail).toBe('finance@northstar.example');
    expect(invoice.customerAddress).toContain('Bengaluru');
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

  it('calculates same-state GST and line totals for multiple products', () => {
    const invoice = service.create({
      id: 'invoice-test-2',
      customerId: 'cust-1',
      customerName: 'Apex Architects',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [
        { productId: 'prod-business-cards', description: '', hsnCode: '', unit: '', quantity: 1, rate: 0, gstRate: 0 },
        { productId: 'prod-matte-paper', description: '', hsnCode: '', unit: '', quantity: 10, rate: 0, gstRate: 0 },
      ],
    });

    expect(invoice.lines).toHaveLength(2);
    expect(invoice.cgst).toBe(100.8);
    expect(invoice.sgst).toBe(100.8);
    expect(invoice.total).toBe(1321.6);
    expect(invoice.lines[1].total).toBe(141.6);
  });

  it('rejects invoices with more than 15 items', () => {
    expect(() => service.create({
      id: 'invoice-too-many-lines',
      customerId: 'cust-1',
      customerName: 'Apex Architects',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: Array.from({ length: 16 }, () => ({
        productId: 'prod-business-cards',
        description: '',
        hsnCode: '',
        unit: '',
        quantity: 1,
        rate: 0,
        gstRate: 0,
      })),
    })).toThrow(BadRequestException);
  });

  it('rejects fractional quantities', () => {
    expect(() => service.create({
      id: 'invoice-fractional-quantity',
      customerId: 'cust-1',
      customerName: 'Apex Architects',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [{
        productId: 'prod-business-cards',
        description: '',
        hsnCode: '',
        unit: '',
        quantity: 1.5,
        rate: 0,
        gstRate: 0,
      }],
    })).toThrow(BadRequestException);
  });

  it('filters invoices by customer ID', () => {
    service.create({
      id: 'invoice-customer-one',
      customerId: 'cust-1',
      customerName: 'Apex Architects',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [{ productId: 'prod-business-cards', description: '', hsnCode: '', unit: '', quantity: 1, rate: 0, gstRate: 0 }],
    });
    service.create({
      id: 'invoice-customer-two',
      customerId: 'cust-2',
      customerName: 'Greenfield Events',
      customerStateCode: '27',
      branchStateCode: '27',
      lines: [{ productId: 'prod-business-cards', description: '', hsnCode: '', unit: '', quantity: 1, rate: 0, gstRate: 0 }],
    });

    expect(service.listIssued('cust-1').map((invoice) => invoice.id)).toEqual(['invoice-customer-one']);
    expect(service.listIssued('cust-no-invoices')).toEqual([]);
  });
});
