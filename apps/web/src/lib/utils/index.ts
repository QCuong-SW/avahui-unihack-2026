import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address?: string | null, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatUsdc(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function generateMockTxHash(): string {
  const hexChars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function generateMockAddress(): string {
  const hexChars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}
