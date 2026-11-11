import { Injectable } from '@nestjs/common';

export interface Product {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  unit: string;
  gstRate: number;
  sellingPrice: number;
  quantityAvailable: number;
}

@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
    { id: 'prod-business-cards', name: 'Business cards', sku: 'BC-001', hsnCode: '4911', unit: 'box', gstRate: 18, sellingPrice: 1000, quantityAvailable: 42 },
    { id: 'prod-matte-paper', name: 'Premium matte paper', sku: 'PMP-001', hsnCode: '4802', unit: 'sheet', gstRate: 18, sellingPrice: 12, quantityAvailable: 12 },
    { id: 'prod-glossy-paper', name: 'Glossy photo paper', sku: 'GPP-001', hsnCode: '4811', unit: 'sheet', gstRate: 18, sellingPrice: 18, quantityAvailable: 120 },
    { id: 'prod-toner', name: 'Black toner cartridge', sku: 'BTC-001', hsnCode: '8443', unit: 'piece', gstRate: 18, sellingPrice: 2800, quantityAvailable: 1 },
    { id: 'prod-catalogue', name: 'Printed catalogues', sku: 'CAT-001', hsnCode: '4911', unit: 'pack', gstRate: 18, sellingPrice: 5000, quantityAvailable: 24 },
  ];

  search(query = ''): Product[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return this.products;
    return this.products.filter((product) =>
      `${product.name} ${product.sku} ${product.hsnCode}`.toLowerCase().includes(normalizedQuery),
    );
  }

  findById(id: string): Product | undefined {
    return this.products.find((product) => product.id === id);
  }
}
