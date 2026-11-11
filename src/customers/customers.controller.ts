import { Controller, Get, Query } from '@nestjs/common';
import { CustomersService } from './customers.service.js';

@Controller('api/v1/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.customersService.search(search);
  }
}
