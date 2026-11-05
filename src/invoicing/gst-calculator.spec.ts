import { describe, expect, it } from '@jest/globals';
import { amountInWords } from '../common/money';
import { calculateGst, financialYear } from './gst-calculator';

describe('GST calculation', () => {
  it('splits same-state tax into CGST and SGST', () => {
    expect(calculateGst({ quantity: 2, rate: 1000, gstRate: 18 }, true)).toEqual({
      taxableValue: 2000,
      cgst: 180,
      sgst: 180,
      igst: 0,
      total: 2360,
    });
  });

  it('uses IGST for an inter-state sale', () => {
    expect(calculateGst({ quantity: 1, rate: 1000, gstRate: 18 }, false).igst).toBe(180);
  });
});

describe('invoice helpers', () => {
  it('uses the Indian financial year boundary', () => {
    expect(financialYear(new Date('2026-03-31T00:00:00Z'))).toBe('25-26');
    expect(financialYear(new Date('2026-04-01T00:00:00Z'))).toBe('26-27');
  });

  it('converts an invoice total to words', () => {
    expect(amountInWords(2360)).toBe('Rupees Two Thousand Three Hundred Sixty Only');
  });
});
