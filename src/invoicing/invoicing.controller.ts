import { Body, Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InvoicePdfService } from '../integrations/pdf/invoice-pdf.service.js';
import { InvoicingService } from './invoicing.service.js';
import type { InvoiceDraft } from './invoicing.service.js';

@Controller('api/v1/invoices')
export class InvoicingController {
  constructor(
    private readonly invoicingService: InvoicingService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  list() {
    return this.invoicingService.listIssued();
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

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(@Param('id') id: string, @Res() response: Response) {
    const invoice = this.invoicingService.findById(id);
    const pdf = await this.invoicePdfService.generate(invoice);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(invoice.invoiceNumber || invoice.id)}.pdf"`);
    response.send(pdf);
  }
}
