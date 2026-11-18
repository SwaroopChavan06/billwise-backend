import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { parsePaginationQuery } from '../common/pagination.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { InvoicePrintService } from '../integrations/pdf/invoice-print.service.js';
import { InvoicingService } from './invoicing.service.js';
import type { InvoiceDraft } from './invoicing.service.js';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoicingController {
  constructor(
    private readonly invoicingService: InvoicingService,
    private readonly invoicePrintService: InvoicePrintService,
  ) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    const pagination = parsePaginationQuery(
      query,
      ['invoiceNumber', 'customerName', 'issueDate', 'total', 'status', 'createdAt'],
      'issueDate',
    );
    return this.invoicingService.listIssued(pagination, query.customerId);
  }

  @Post('drafts')
  createDraft(@Body() draft: InvoiceDraft) {
    return this.invoicingService.createDraft(draft);
  }

  @Post()
  create(@Body() draft: InvoiceDraft) {
    return this.invoicingService.create(draft);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string) {
    return this.invoicingService.issue(id);
  }

  @Get(':id/print')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async printInvoice(@Param('id') id: string, @Res() response: Response) {
    const invoice = await this.invoicingService.findById(id);
    const printableInvoice = this.invoicePrintService.generate(invoice);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(invoice.invoiceNumber || invoice.id)}.html"`);
    response.send(printableInvoice);
  }
}
