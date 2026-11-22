import { parseLocalISO, toLocalISO } from '@/lib/dates';

import { addMonthsAnchored } from './schedule';

/** Choices offered on a credit-card expense; 1 = single payment. */
export const INSTALLMENT_CHOICES = [1, 2, 3, 4, 6, 9, 12] as const;

/** Equal monthly parts; the first one carries the rounding difference, as banks do. */
export function splitInstallments(totalMinor: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(totalMinor / n);
  const rest = totalMinor - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? rest : 0));
}

/** One date per month on the purchase day (clamped in short months), keeping the time. */
export function installmentDates(firstLocalIso: string, count: number): string[] {
  const first = parseLocalISO(firstLocalIso);
  return Array.from({ length: Math.max(1, count) }, (_, i) => toLocalISO(addMonthsAnchored(first, i, first.getDate())));
}
