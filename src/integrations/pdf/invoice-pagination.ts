export interface InvoicePaginationMetrics {
  pageHeight: number;
  firstPageHeaderHeight: number;
  tableHeaderHeight: number;
  footerHeight: number;
  pageMetaHeight: number;
  itemsTopGap: number;
  footerGap: number;
}

export function paginateInvoice(rowHeights: readonly number[], metrics: InvoicePaginationMetrics): number[][] {
  const metricValues = Object.values(metrics);
  if (metricValues.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Invoice pagination measurements must be finite, non-negative numbers');
  }
  if (rowHeights.some((height) => !Number.isFinite(height) || height <= 0)) {
    throw new RangeError('Invoice row heights must be finite positive numbers');
  }
  if (rowHeights.length === 0) return [[]];

  const continuationCapacity = metrics.pageHeight -
    metrics.tableHeaderHeight -
    metrics.pageMetaHeight -
    metrics.itemsTopGap;
  const firstPageCapacity = continuationCapacity - metrics.firstPageHeaderHeight;
  const capacities = [
    firstPageCapacity - metrics.footerHeight - metrics.footerGap,
    continuationCapacity - metrics.footerHeight - metrics.footerGap,
  ];
  const nonFinalCapacities = [firstPageCapacity, continuationCapacity];
  if (capacities.some((capacity) => capacity <= 0) || nonFinalCapacities.some((capacity) => capacity <= 0)) {
    throw new RangeError('Invoice header, rows, and footer do not fit within the page');
  }

  const pages: number[][] = [];
  let firstRow = 0;
  while (firstRow < rowHeights.length) {
    const isFirstPage = pages.length === 0;
    const finalCapacity = capacities[isFirstPage ? 0 : 1];
    const remainingHeight = rowHeights.slice(firstRow).reduce((total, height) => total + height, 0);
    if (remainingHeight <= finalCapacity) {
      pages.push(rowHeights.slice(firstRow).map((_, index) => firstRow + index));
      break;
    }

    const pageCapacity = nonFinalCapacities[isFirstPage ? 0 : 1];
    const pageRows: number[] = [];
    let usedHeight = 0;
    while (firstRow + pageRows.length < rowHeights.length) {
      const nextHeight = rowHeights[firstRow + pageRows.length];
      if (usedHeight + nextHeight > pageCapacity) break;
      pageRows.push(firstRow + pageRows.length);
      usedHeight += nextHeight;
    }

    if (pageRows.length === 0) {
      throw new RangeError('An invoice item row is too tall to fit on a page with the required footer');
    }

    if (firstRow + pageRows.length === rowHeights.length && usedHeight > finalCapacity) {
      while (usedHeight > finalCapacity && pageRows.length > 1) {
        const movedRow = pageRows.pop();
        if (movedRow === undefined) throw new RangeError('Unable to reserve footer space for the final invoice page');
        usedHeight -= rowHeights[movedRow];
      }
      if (usedHeight > finalCapacity) {
        throw new RangeError('An invoice item row is too tall to fit on a page with the required footer');
      }
    }

    pages.push(pageRows);
    firstRow += pageRows.length;
  }
  return pages;
}
