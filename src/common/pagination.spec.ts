import { BadRequestException } from '@nestjs/common';
import { paginationMetadata, parsePaginationQuery } from './pagination';

describe('pagination', () => {
  it('uses the default page and page size', () => {
    expect(parsePaginationQuery({}, ['name'], 'name')).toEqual({
      page: 1,
      limit: 20,
      search: '',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('parses filters and a bounded sort choice', () => {
    expect(parsePaginationQuery({
      page: '3',
      limit: '1000',
      search: '  paper ',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, ['name', 'createdAt'], 'name')).toEqual({
      page: 3,
      limit: 1000,
      search: 'paper',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it.each([
    { page: '0' },
    { page: '1.2' },
    { limit: '1001' },
    { sortBy: 'unsafeField' },
    { sortOrder: 'sideways' },
  ])('rejects invalid pagination input %o', (query) => {
    expect(() => parsePaginationQuery(query, ['name'], 'name')).toThrow(BadRequestException);
  });

  it('returns zero pages for an empty table and clamps stale page requests', () => {
    expect(paginationMetadata(8, 20, 0)).toEqual({
      currentPage: 1,
      pageSize: 20,
      totalRecords: 0,
      totalPages: 0,
    });
    expect(paginationMetadata(8, 20, 41).currentPage).toBe(3);
  });
});
