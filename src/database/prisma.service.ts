import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export const DEFAULT_BRANCH_ID = 'billwise-default-branch';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.branch.upsert({
      where: { id: DEFAULT_BRANCH_ID },
      create: {
        id: DEFAULT_BRANCH_ID,
        name: 'Sakshi Swayam Rojgar Stationary Utpadan Kendra',
        legalName: 'Sakshi Swayam Rojgar Stationary Utpadan Kendra (26-27)',
        gstin: '27AOSPC7246L1ZD',
        pan: 'BLJPM3008B',
        address: '2896-1, Bhairavwadi, Near Panchayat Samiti, Main Road Kudal, Tal-Kudal 416520, Dist-Sindhudurg',
        stateCode: '27',
        phone: '9823141369',
        bankName: 'Bank of Maharashtra',
        bankAccount: '60207308004',
        bankIfsc: 'MAHB0000070',
      },
      update: {},
    });

    if (process.env.NODE_ENV !== 'production') await this.seedDevelopmentCatalog();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async seedDevelopmentCatalog(): Promise<void> {
    const [customerCount, productCount] = await Promise.all([
      this.customer.count({ where: { branchId: DEFAULT_BRANCH_ID, deletedAt: null } }),
      this.product.count({ where: { branchId: DEFAULT_BRANCH_ID, deletedAt: null } }),
    ]);

    if (customerCount === 0) {
      await this.customer.createMany({
        data: [
          { id: 'cust-1', branchId: DEFAULT_BRANCH_ID, name: 'Apex Architects', gstin: '27ABCDE1234F1Z5', phone: '+91 98765 43210', email: 'accounts@apex.example', address: '12 Design District, Mumbai, Maharashtra', stateCode: '27' },
          { id: 'cust-2', branchId: DEFAULT_BRANCH_ID, name: 'Greenfield Events', phone: '+91 98200 11223', email: 'billing@greenfield.example', address: '45 Garden Road, Mumbai, Maharashtra', stateCode: '27' },
          { id: 'cust-3', branchId: DEFAULT_BRANCH_ID, name: 'Northstar Retail', phone: '+91 98100 44556', email: 'finance@northstar.example', address: '8 Market Street, Bengaluru, Karnataka', stateCode: '29' },
        ],
        skipDuplicates: true,
      });
    }

    if (productCount === 0) {
      await this.product.createMany({
        data: [
          { id: 'prod-business-cards', branchId: DEFAULT_BRANCH_ID, name: 'Business cards', sku: 'BC-001', hsnCode: '4911', unit: 'box', gstRate: 18, sellingPrice: 1000, quantityAvailable: 42 },
          { id: 'prod-matte-paper', branchId: DEFAULT_BRANCH_ID, name: 'Premium matte paper', sku: 'PMP-001', hsnCode: '4802', unit: 'sheet', gstRate: 18, sellingPrice: 12, quantityAvailable: 12 },
          { id: 'prod-glossy-paper', branchId: DEFAULT_BRANCH_ID, name: 'Glossy photo paper', sku: 'GPP-001', hsnCode: '4811', unit: 'sheet', gstRate: 18, sellingPrice: 18, quantityAvailable: 120 },
          { id: 'prod-toner', branchId: DEFAULT_BRANCH_ID, name: 'Black toner cartridge', sku: 'BTC-001', hsnCode: '8443', unit: 'piece', gstRate: 18, sellingPrice: 2800, quantityAvailable: 1 },
          { id: 'prod-catalogue', branchId: DEFAULT_BRANCH_ID, name: 'Printed catalogues', sku: 'CAT-001', hsnCode: '4911', unit: 'pack', gstRate: 18, sellingPrice: 5000, quantityAvailable: 24 },
        ],
        skipDuplicates: true,
      });
    }
  }
}
