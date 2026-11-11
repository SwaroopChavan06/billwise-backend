import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import type { Customer } from './customers.service.js';

@Controller('api/v1/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.customersService.search(search);
  }

  @Post()
  create(@Body() customer: Omit<Customer, 'id'>) {
    return this.customersService.create(customer);
  }
}
