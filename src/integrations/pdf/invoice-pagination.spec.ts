import { paginateInvoice, type InvoicePaginationMetrics } from './invoice-pagination';

const metrics: InvoicePaginationMetrics = {
  pageHeight: 200,
  firstPageHeaderHeight: 20,
  tableHeaderHeight: 10,
  footerHeight: 30,
  pageMetaHeight: 10,
  itemsTopGap: 0,
  footerGap: 0,
};

describe('paginateInvoice', () => {
  it('keeps a single item with the final-page footer when it fits', () => {
    expect(paginateInvoice([25], metrics)).toEqual([[0]]);
  });

  it('greedily fills pages according to measured heights', () => {
    expect(paginateInvoice(Array(5).fill(10), metrics)).toEqual([
      Array.from({ length: 5 }, (_, index) => index),
    ]);
    expect(paginateInvoice(Array(12).fill(10), metrics)).toEqual([Array.from({ length: 12 }, (_, index) => index)]);
    expect(paginateInvoice(Array(24).fill(10), metrics)).toEqual([
      Array.from({ length: 16 }, (_, index) => index),
      Array.from({ length: 8 }, (_, index) => index + 16),
    ]);
  });

  it('moves a row with the footer rather than generating a footer-only page', () => {
    const boundaryMetrics = { ...metrics, pageHeight: 150, firstPageHeaderHeight: 20 };
    const pages = paginateInvoice([20, 20, 20, 20, 20], boundaryMetrics);

    expect(pages).toEqual([[0, 1, 2, 3], [4]]);
    expect(pages.every((page) => page.length > 0)).toBe(true);
  });

  it('moves rows off an overfull final candidate page until the footer fits', () => {
    expect(paginateInvoice(Array(50).fill(10), metrics)).toEqual([
      Array.from({ length: 16 }, (_, index) => index),
      Array.from({ length: 18 }, (_, index) => index + 16),
      Array.from({ length: 15 }, (_, index) => index + 34),
      [49],
    ]);
  });

  it('splits 60 measured rows across multiple pages without losing rows', () => {
    const pages = paginateInvoice(Array(60).fill(10), metrics);

    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.flat()).toEqual(Array.from({ length: 60 }, (_, index) => index));
    expect(pages.every((page) => page.length > 0)).toBe(true);
  });
});
