import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service.js';

@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.productsService.search(search);
  }
}
