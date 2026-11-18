import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import type { Customer } from './customers.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { parsePaginationQuery } from '../common/pagination.js';

@Controller('api/v1/customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    const pagination = parsePaginationQuery(query, ['name', 'phone', 'email', 'createdAt'], 'name');
    return this.customersService.search(pagination);
  }

  @Post()
  create(@Body() customer: Omit<Customer, 'id'>) {
    return this.customersService.create(customer);
  }
}
