import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InvoicingService } from './invoicing.service.js';
import type { InvoiceDraft } from './invoicing.service.js';

@Controller('api/v1/invoices')
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Get()
  list() {
    return this.invoicingService.listIssued();
  }

  @Post('drafts')
  createDraft(@Body() draft: InvoiceDraft) {
    return this.invoicingService.createDraft(draft);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string) {
    return this.invoicingService.issue(id);
  }
}
