import { BadRequestException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  it('creates a customer with normalized contact details', () => {
    const service = new CustomersService();
    const customer = service.create({
      name: '  New Customer ',
      phone: ' 555-1234 ',
      email: ' new@example.com ',
      address: ' 1 Main Street ',
      stateCode: ' 27 ',
      gstin: ' ',
    });

    expect(customer).toMatchObject({
      name: 'New Customer',
      phone: '555-1234',
      email: 'new@example.com',
      address: '1 Main Street',
      stateCode: '27',
      gstin: undefined,
    });
    expect(service.findById(customer.id)).toEqual(customer);
  });

  it('requires customer name, phone, address, and state code', () => {
    const service = new CustomersService();
    expect(() => service.create({
      name: '',
      phone: '',
      email: '',
      address: '',
      stateCode: '',
    })).toThrow(BadRequestException);
  });
});
