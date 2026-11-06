import { USDC_DECIMALS } from '@avahui/shared';

export function normalizeAddress(address?: string | null): string {
  if (!address) return '';
  return address.trim().toLowerCase();
}

export function formatUsdcUnits(
  rawAmount: { toString(): string } | string | bigint | number | null | undefined,
  decimals = USDC_DECIMALS,
): string {
  if (rawAmount === null || rawAmount === undefined) return '0.00';
  const str = typeof rawAmount === 'object' ? rawAmount.toString() : String(rawAmount);
  const cleanStr = str.split('.')[0] || '0';
  try {
    const val = BigInt(cleanStr);
    const divisor = BigInt(10 ** decimals);
    const whole = val / divisor;
    const rem = val % divisor;
    const remStr = rem.toString().padStart(decimals, '0').slice(0, 2);
    return `${whole.toString()}.${remStr}`;
  } catch {
    return '0.00';
  }
}

