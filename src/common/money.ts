export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function amountInWords(value: number): string {
  const rounded = roundMoney(value);
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  const words = integerToWords(rupees);
  return paise > 0
    ? `Rupees ${words} and ${integerToWords(paise)} Paise Only`
    : `Rupees ${words} Only`;
}

function integerToWords(value: number): string {
  if (value === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];
  const groups = [value % 1000];
  let remaining = Math.floor(value / 1000);
  while (remaining > 0) {
    groups.push(remaining % 100);
    remaining = Math.floor(remaining / 100);
  }
  return groups
    .map((group, index) => (group ? `${underThousand(group)} ${scales[index]}` : ''))
    .filter(Boolean)
    .reverse()
    .join(' ')
    .trim();
}

function underThousand(value: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const parts: string[] = [];
  if (value >= 100) parts.push(`${ones[Math.floor(value / 100)]} Hundred`);
  const remainder = value % 100;
  if (remainder >= 20) parts.push([tens[Math.floor(remainder / 10)], ones[remainder % 10]].filter(Boolean).join(' '));
  else if (remainder >= 10) parts.push(teens[remainder - 10]);
  else if (remainder > 0) parts.push(ones[remainder]);
  return parts.join(' ');
}
