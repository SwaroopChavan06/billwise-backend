import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import type { ProductInput } from './products.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { parsePaginationQuery } from '../common/pagination.js';

@Controller('api/v1/products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    const pagination = parsePaginationQuery(
      query,
      ['name', 'sku', 'hsnCode', 'sellingPrice', 'quantityAvailable', 'createdAt'],
      'name',
    );
    return this.productsService.search(pagination);
  }

  @Post()
  create(@Body() product: ProductInput) {
    return this.productsService.create(product);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() product: ProductInput) {
    return this.productsService.update(id, product);
  }
}
