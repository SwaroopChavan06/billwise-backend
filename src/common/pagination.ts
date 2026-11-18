import { BadRequestException } from '@nestjs/common';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export function parsePaginationQuery(
  query: Record<string, string | undefined>,
  allowedSortFields: readonly string[],
  defaultSortBy: string,
): PaginationQuery {
  const page = parseInteger(query.page, 1, 'page');
  const limit = parseInteger(query.limit, DEFAULT_PAGE_SIZE, 'limit');
  if (limit > Math.max(...PAGE_SIZE_OPTIONS)) {
    throw new BadRequestException(`limit must be no greater than ${Math.max(...PAGE_SIZE_OPTIONS)}`);
  }
  const sortBy = query.sortBy ?? defaultSortBy;
  if (!allowedSortFields.includes(sortBy)) {
    throw new BadRequestException(`sortBy must be one of: ${allowedSortFields.join(', ')}`);
  }
  const sortOrder = query.sortOrder ?? 'asc';
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new BadRequestException('sortOrder must be asc or desc');
  }
  return {
    page,
    limit,
    search: query.search?.trim() ?? '',
    sortBy,
    sortOrder,
  };
}

export function paginationMetadata(
  page: number,
  limit: number,
  totalRecords: number,
): PaginatedResult<never>['pagination'] {
  const totalPages = Math.ceil(totalRecords / limit);
  return {
    currentPage: totalPages === 0 ? 1 : Math.min(page, totalPages),
    pageSize: limit,
    totalRecords,
    totalPages,
  };
}

function parseInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new BadRequestException(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new BadRequestException(`${name} must be a positive integer`);
  return parsed;
}
