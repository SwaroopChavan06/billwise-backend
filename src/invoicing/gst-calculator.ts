import { roundMoney } from '../common/money.js';

export interface GstLine {
  quantity: number;
  rate: number;
  discount?: number;
  gstRate: number;
}

export interface GstResult {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function calculateGst(line: GstLine, sameState: boolean): GstResult {
  const taxableValue = roundMoney(Math.max(0, line.quantity * line.rate - (line.discount ?? 0)));
  const tax = roundMoney((taxableValue * line.gstRate) / 100);
  const cgst = sameState ? roundMoney(tax / 2) : 0;
  const sgst = sameState ? roundMoney(tax - cgst) : 0;
  const igst = sameState ? 0 : tax;
  return { taxableValue, cgst, sgst, igst, total: roundMoney(taxableValue + tax) };
}

export function financialYear(date: Date): string {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}
