import type { TxKind } from '@/db/types';

export type ExistingTx = { kind: TxKind; amountMinor: number; currency: string; occurredAt: string };

/** `imported`: the same row came in before. `similar`: a transaction with the same amount within a day already exists. */
export type CandidateStatus = 'new' | 'imported' | 'similar';

export type Probe = { key: string; kind: TxKind; amountMinor: number; currency: string; occurredAt: string };

const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

/**
 * Sorts candidates into new / imported before / probably already entered.
 * Each existing transaction can vouch for one candidate only, so two coffees
 * on the same day against one saved coffee flag just one of them.
 */
export function classify(probes: Probe[], importedKeys: Set<string>, existing: ExistingTx[]): Map<string, CandidateStatus> {
  const result = new Map<string, CandidateStatus>();
  const pool = existing.map((e) => ({ ...e, day: dayNumber(e.occurredAt), used: false }));
  for (const p of probes) {
    if (importedKeys.has(p.key)) {
      result.set(p.key, 'imported');
      continue;
    }
    const day = dayNumber(p.occurredAt);
    const match = pool.find(
      (e) => !e.used && e.kind === p.kind && e.currency === p.currency && e.amountMinor === p.amountMinor && Math.abs(e.day - day) <= 1,
    );
    if (match) match.used = true;
    result.set(p.key, match ? 'similar' : 'new');
  }
  return result;
}
