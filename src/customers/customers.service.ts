import { Injectable, NotFoundException } from '@nestjs/common';

export interface Customer {
  id: string;
  name: string;
  gstin?: string;
  phone: string;
  email: string;
  address: string;
  stateCode: string;
}

@Injectable()
export class CustomersService {
  private readonly customers: Customer[] = [
    { id: 'cust-1', name: 'Apex Architects', gstin: '27ABCDE1234F1Z5', phone: '+91 98765 43210', email: 'accounts@apex.example', address: '12 Design District, Mumbai, Maharashtra', stateCode: '27' },
    { id: 'cust-2', name: 'Greenfield Events', phone: '+91 98200 11223', email: 'billing@greenfield.example', address: '45 Garden Road, Mumbai, Maharashtra', stateCode: '27' },
    { id: 'cust-3', name: 'Northstar Retail', phone: '+91 98100 44556', email: 'finance@northstar.example', address: '8 Market Street, Bengaluru, Karnataka', stateCode: '29' },
  ];

  search(query = ''): Customer[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return this.customers;
    return this.customers.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(normalizedQuery),
    );
  }

  findById(id: string): Customer {
    const customer = this.customers.find((item) => item.id === id);
    if (!customer) throw new NotFoundException(`Customer ${id} was not found`);
    return customer;
  }
}
